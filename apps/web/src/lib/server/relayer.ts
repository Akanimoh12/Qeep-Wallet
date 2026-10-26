import "server-only";
import { qeepAccountAbi, qeepFactoryAbi } from "@qeep/sdk";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  isAddress,
  isHex,
  type Address,
  type ContractFunctionArgs,
  type EncodeFunctionDataParameters,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { publicClient } from "../client";
import { config, isConfigured } from "../config";
import type { RelayRequest, RelayResponse } from "../relay-types";

/**
 * Qeep relayer: submits user-signed actions and pays the gas in BTC.
 * It cannot move funds on its own. Every action is checked on-chain against the
 * user's Daily key signature or one-time Vault Key signature.
 */

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

type VaultSignature = ContractFunctionArgs<typeof qeepAccountAbi, "nonpayable", "vaultExecute">[4];

function relayerAccount(): PrivateKeyAccount {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !isHex(key) || key.length !== 66) throw new Error("Relayer is not configured (RELAYER_PRIVATE_KEY).");
  return privateKeyToAccount(key as Hex);
}

/**
 * Signs and sends a contract call with every field set explicitly.
 * viem's writeContract takes its gas from eth_fillTransaction when the node offers it, and Mezo's
 * eth_fillTransaction returns only the intrinsic gas (no execution), so the node then rejects the
 * transaction below the EIP-7623 floor. eth_estimateGas on Mezo is correct, so we use it directly.
 */
async function submit(relayer: PrivateKeyAccount, call: { address: Address } & EncodeFunctionDataParameters) {
  const data = encodeFunctionData(call as EncodeFunctionDataParameters);
  const [gas, nonce, fees] = await Promise.all([
    publicClient.estimateGas({ account: relayer.address, to: call.address, data }),
    publicClient.getTransactionCount({ address: relayer.address, blockTag: "pending" }),
    publicClient.estimateFeesPerGas(),
  ]);
  const serializedTransaction = await relayer.signTransaction({
    type: "eip1559",
    chainId: config.chainId,
    to: call.address,
    data,
    nonce,
    gas: (gas * 12n) / 10n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  return publicClient.sendRawTransaction({ serializedTransaction });
}

function addr(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new Error(`Invalid ${field}`);
  return value;
}

function b32(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !BYTES32.test(value)) throw new Error(`Invalid ${field}`);
  return value as Hex;
}

function uint(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d{1,78}$/.test(value)) throw new Error(`Invalid ${field}`);
  return BigInt(value);
}

function hexData(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !isHex(value) || value.length > 20_000) throw new Error(`Invalid ${field}`);
  return value;
}

async function assertQeepAccount(account: Address) {
  const ok = await publicClient.readContract({
    address: config.factory,
    abi: qeepFactoryAbi,
    functionName: "isQeepAccount",
    args: [account],
  });
  if (!ok) throw new Error("Not a Qeep account");
}

function revertReason(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage;
    }
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export async function handleRelay(body: RelayRequest): Promise<RelayResponse> {
  if (!isConfigured()) return { error: "Qeep is not configured: set NEXT_PUBLIC_FACTORY_ADDRESS." };

  try {
    const relayer = relayerAccount();

    switch (body?.action) {
      case "create": {
        const owner = addr(body.owner, "owner");
        const firstVaultKeyHash = b32(body.firstVaultKeyHash, "firstVaultKeyHash");
        const dailyLimit = uint(body.dailyLimit, "dailyLimit");
        const args = [owner, firstVaultKeyHash, dailyLimit] as const;

        const { request, result } = await publicClient.simulateContract({
          account: relayer,
          address: config.factory,
          abi: qeepFactoryAbi,
          functionName: "createAccount",
          args,
        });
        const hash = await submit(relayer, request);
        return { hash, account: result };
      }

      case "spend": {
        const account = addr(body.account, "account");
        await assertQeepAccount(account);
        const signature = hexData(body.signature, "signature");
        if (signature.length !== 132) throw new Error("Invalid signature");

        const { request } = await publicClient.simulateContract({
          account: relayer,
          address: account,
          abi: qeepAccountAbi,
          functionName: "spend",
          args: [addr(body.to, "to"), uint(body.amount, "amount"), uint(body.deadline, "deadline"), signature],
        });
        return { hash: await submit(relayer, request) };
      }

      case "vault": {
        const account = addr(body.account, "account");
        await assertQeepAccount(account);
        if (!Array.isArray(body.signature) || body.signature.length !== 67) throw new Error("Invalid Vault signature");
        const signature = body.signature.map((s, i) => b32(s, `signature[${i}]`));

        const { request } = await publicClient.simulateContract({
          account: relayer,
          address: account,
          abi: qeepAccountAbi,
          functionName: "vaultExecute",
          args: [
            addr(body.target, "target"),
            uint(body.value, "value"),
            hexData(body.data, "data"),
            b32(body.nextKeyHash, "nextKeyHash"),
            signature as unknown as VaultSignature,
          ],
        });
        return { hash: await submit(relayer, request) };
      }

      default:
        return { error: "Unknown action" };
    }
  } catch (error) {
    return { error: revertReason(error) };
  }
}

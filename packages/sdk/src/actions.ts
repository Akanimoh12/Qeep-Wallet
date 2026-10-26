import { encodeFunctionData, type Address, type Hex } from "viem";
import { erc20Abi, qeepAccountAbi } from "./abi";
import { vaultDigest } from "./digests";
import { wotsKeyHash, wotsSign } from "./wots";

export type VaultActionInput = {
  /** 32-byte seed from vaultSeedFromPhrase(). */
  seed: Hex;
  chainId: number;
  account: Address;
  /** The account's current vaultNonce, read from the chain right before signing. */
  nonce: bigint;
  /** The account's current vaultKeyHash, read from the chain right before signing. */
  currentKeyHash: Hex;
  target: Address;
  value?: bigint;
  data: Hex;
};

export type SignedVaultAction = {
  target: Address;
  value: bigint;
  data: Hex;
  nextKeyHash: Hex;
  signature: Hex[];
};

export class WrongVaultKeyError extends Error {
  constructor() {
    super("This Vault Key phrase does not belong to this Qeep account.");
    this.name = "WrongVaultKeyError";
  }
}

/**
 * Signs one vault action with the one-time key for `nonce` and commits to key `nonce + 1`.
 * Throws WrongVaultKeyError before signing if the phrase does not match the account,
 * so a wrong phrase never produces a signature.
 */
export function signVaultAction(input: VaultActionInput): SignedVaultAction {
  const index = Number(input.nonce);
  if (wotsKeyHash(input.seed, index).toLowerCase() !== input.currentKeyHash.toLowerCase()) {
    throw new WrongVaultKeyError();
  }
  const value = input.value ?? 0n;
  const nextKeyHash = wotsKeyHash(input.seed, index + 1);
  const digest = vaultDigest({
    chainId: input.chainId,
    account: input.account,
    nonce: input.nonce,
    target: input.target,
    value,
    data: input.data,
    nextKeyHash,
  });
  return { target: input.target, value, data: input.data, nextKeyHash, signature: wotsSign(input.seed, index, digest) };
}

/** Calldata for a MUSD transfer out of the account (used as a vault action). */
export function musdTransferCall(to: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });
}

export function setOwnerCall(newOwner: Address): Hex {
  return encodeFunctionData({ abi: qeepAccountAbi, functionName: "setOwner", args: [newOwner] });
}

export function setDailyLimitCall(newLimit: bigint): Hex {
  return encodeFunctionData({ abi: qeepAccountAbi, functionName: "setDailyLimit", args: [newLimit] });
}

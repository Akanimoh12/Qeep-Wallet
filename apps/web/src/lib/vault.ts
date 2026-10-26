import { qeepAccountAbi, signVaultAction } from "@qeep/sdk";
import { BaseError, parseEventLogs, type Address, type Hex } from "viem";
import { publicClient } from "./client";
import { config } from "./config";
import { relay } from "./relay";
import type { VaultRelayRequest } from "./relay-types";

/**
 * Vault Key actions, with the one-time-key rules enforced in one place:
 *
 * 1. The key index always comes from the chain (vaultNonce), never from local state.
 * 2. The action is dry-run from the account before signing, so a failing action is never signed.
 * 3. A signed action is saved as "pending" until it lands. If it didn't land, the SAME signed
 *    action is sent again instead of signing something new with the same one-time key.
 */

const PENDING_KEY = "qeep.pendingVault.v1";

type PendingVault = { account: Address; nonce: string; request: VaultRelayRequest };

function loadPending(): PendingVault | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingVault) : null;
  } catch {
    return null;
  }
}

function savePending(p: PendingVault) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

function clearPending() {
  localStorage.removeItem(PENDING_KEY);
}

export class PendingVaultActionError extends Error {
  constructor(hash: Hex) {
    super(
      `Qeep first finished an earlier Vault action that was signed but not confirmed (tx ${hash.slice(0, 10)}…). ` +
        "This keeps your one-time key safe. Check your balance, then try again.",
    );
    this.name = "PendingVaultActionError";
  }
}

async function submit(request: VaultRelayRequest): Promise<Hex> {
  const { hash, receipt } = await relay(request);
  clearPending();
  const failed = parseEventLogs({ abi: qeepAccountAbi, eventName: "VaultCallFailed", logs: receipt.logs });
  if (failed.length > 0) {
    throw new Error("The Vault Key was accepted but the action itself failed. Nothing moved. Please try again.");
  }
  return hash;
}

export async function executeVaultAction(params: {
  seed: Hex;
  account: Address;
  target: Address;
  data: Hex;
  value?: bigint;
}): Promise<Hex> {
  const value = params.value ?? 0n;
  const [nonce, currentKeyHash] = await Promise.all([
    publicClient.readContract({ address: params.account, abi: qeepAccountAbi, functionName: "vaultNonce" }),
    publicClient.readContract({ address: params.account, abi: qeepAccountAbi, functionName: "vaultKeyHash" }),
  ]);

  // Rule 3: never sign a second message with a one-time key that already signed one.
  const pending = loadPending();
  if (pending && pending.account.toLowerCase() === params.account.toLowerCase()) {
    if (BigInt(pending.nonce) === nonce) {
      const same =
        pending.request.target.toLowerCase() === params.target.toLowerCase() &&
        pending.request.data === params.data &&
        pending.request.value === value.toString();
      const hash = await submit(pending.request);
      if (same) return hash;
      throw new PendingVaultActionError(hash);
    }
    clearPending(); // It landed already.
  }

  // Rule 2: dry-run the action as the account before any signature exists.
  try {
    await publicClient.call({ account: params.account, to: params.target, data: params.data, value });
  } catch (err) {
    const reason = err instanceof BaseError ? err.shortMessage : "the call reverted";
    throw new Error(`This action would fail, so it was not signed: ${reason}`);
  }

  // Rule 1: sign with the key for the on-chain nonce.
  const signed = signVaultAction({
    seed: params.seed,
    chainId: config.chainId,
    account: params.account,
    nonce,
    currentKeyHash,
    target: params.target,
    value,
    data: params.data,
  });

  const request: VaultRelayRequest = {
    action: "vault",
    account: params.account,
    target: signed.target,
    value: signed.value.toString(),
    data: signed.data,
    nextKeyHash: signed.nextKeyHash,
    signature: signed.signature,
  };
  savePending({ account: params.account, nonce: nonce.toString(), request });
  return submit(request);
}

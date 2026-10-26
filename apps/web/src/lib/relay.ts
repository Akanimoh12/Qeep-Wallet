import type { Hex, TransactionReceipt } from "viem";
import { publicClient } from "./client";
import type { RelayRequest } from "./relay-types";

export type RelayResult = { hash: Hex; account?: `0x${string}`; receipt: TransactionReceipt };

/**
 * Sends a signed request to Qeep's relayer, which pays the gas, then waits for the
 * transaction on Mezo. Signatures are made in the browser; the relayer never sees keys.
 */
export async function relay(request: RelayRequest): Promise<RelayResult> {
  const res = await fetch("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = await res.json().catch(() => ({ error: "Relayer returned an invalid response" }));
  if (!res.ok || "error" in body) throw new Error(body.error ?? `Relayer error (${res.status})`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: body.hash, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error("The transaction failed on Mezo.");
  return { ...body, receipt };
}

"use client";

import { erc20Abi, qeepAccountAbi } from "@qeep/sdk";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { publicClient } from "./client";
import { config } from "./config";

export type AccountState = {
  balance: bigint;
  remainingToday: bigint;
  dailyLimit: bigint;
  owner: Address;
  vaultNonce: bigint;
  vaultKeyHash: Hex;
  spendNonce: bigint;
};

export async function readAccountState(account: Address): Promise<AccountState> {
  const read = <T>(functionName: string) =>
    publicClient.readContract({
      address: account,
      abi: qeepAccountAbi,
      functionName: functionName as never,
    }) as Promise<T>;

  const [balance, remainingToday, dailyLimit, owner, vaultNonce, vaultKeyHash, spendNonce] = await Promise.all([
    publicClient.readContract({ address: config.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    read<bigint>("remainingToday"),
    read<bigint>("dailyLimit"),
    read<Address>("owner"),
    read<bigint>("vaultNonce"),
    read<Hex>("vaultKeyHash"),
    read<bigint>("spendNonce"),
  ]);
  return { balance, remainingToday, dailyLimit, owner, vaultNonce, vaultKeyHash, spendNonce };
}

/** Live on-chain state of a Qeep account. Refreshes every 15 seconds and on window focus. */
export function useAccountState(account: Address | undefined) {
  const [state, setState] = useState<AccountState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      setState(await readAccountState(account));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Mezo");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { state, error, loading, refresh };
}

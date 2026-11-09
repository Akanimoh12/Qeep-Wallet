"use client";

import { MEZO_CONTRACTS, readMezoPosition, type MezoContracts, type MezoPosition } from "@qeep/sdk";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "./client";
import { config } from "./config";

/** Mezo protocol contracts for the configured chain. */
export const mezo: MezoContracts = MEZO_CONTRACTS[config.chainId];

export type MezoState = MezoPosition & { btcBalance: bigint };

/** Live Mezo position of a Qeep account (trove, Stability Pool, BTC price). Refreshes every 15 seconds. */
export function useMezoPosition(account: Address | undefined) {
  const [state, setState] = useState<MezoState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const [position, btcBalance] = await Promise.all([
        readMezoPosition(publicClient, mezo, account),
        publicClient.getBalance({ address: account }),
      ]);
      setState({ ...position, btcBalance });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Mezo");
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, error, refresh };
}

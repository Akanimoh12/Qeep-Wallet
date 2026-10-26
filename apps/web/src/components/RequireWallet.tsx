"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useWallet } from "@/lib/wallet";

/** Sends visitors without a wallet on this device to the welcome screen (/start). */
export function RequireWallet({ children }: { children: ReactNode }) {
  const { ready, wallet } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (ready && !wallet) router.replace("/start");
  }, [ready, wallet, router]);

  if (!ready || !wallet) return null;
  return <>{children}</>;
}

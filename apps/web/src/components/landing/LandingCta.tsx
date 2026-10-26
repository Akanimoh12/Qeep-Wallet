"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import s from "@/app/landing.module.css";

/** The main call to action: opens the wallet, or starts setup on a new device. */
export function LandingCta({ variant = "primary" }: { variant?: "primary" | "nav" }) {
  const { ready, wallet } = useWallet();
  const hasWallet = ready && !!wallet;
  const href = hasWallet ? "/home" : "/start";

  if (variant === "nav") {
    return (
      <Link href={href} className={s.navButton}>
        {hasWallet ? "Open wallet" : "Launch app"}
      </Link>
    );
  }

  return (
    <Link href={href} className={s.primary}>
      {hasWallet ? "Open my wallet" : "Open the wallet"}
      <svg
        className={s.primaryArrow}
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 9h11M10 4.5L14.5 9 10 13.5" />
      </svg>
    </Link>
  );
}

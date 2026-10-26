"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Brand";
import { isConfigured } from "@/lib/config";
import { useWallet } from "@/lib/wallet";

export default function Welcome() {
  const { ready, wallet } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (ready && wallet) router.replace("/home");
  }, [ready, wallet, router]);

  return (
    <div className="screen" style={{ justifyContent: "space-between", paddingTop: 48 }}>
      <Link href="/" style={{ textDecoration: "none", color: "var(--text)" }} aria-label="Qeep home">
        <Logo size={36} />
      </Link>

      <div className="stack-lg">
        <span className="badge">Post-quantum ready</span>
        <h1 className="h1 hero">Your Bitcoin dollars, kept safe for decades.</h1>
        <p className="lead" style={{ fontSize: 16 }}>
          Save and spend MUSD with a vault that stays secure even after quantum computers arrive.
        </p>
      </div>

      <div className="stack-lg">
        {!isConfigured() && (
          <div className="notice notice-warn">
            <span>
              <strong>Setup needed.</strong> Set NEXT_PUBLIC_FACTORY_ADDRESS to your deployed QeepAccountFactory.
            </span>
          </div>
        )}
        <Link href="/create" className="btn btn-primary">
          Create wallet
        </Link>
        <Link href="/restore" className="btn btn-secondary">
          Restore with Vault Key
        </Link>
        <p className="muted small" style={{ textAlign: "center", margin: "8px 0 0" }}>
          Runs on Mezo testnet · Gas is on us
        </p>
      </div>
    </div>
  );
}

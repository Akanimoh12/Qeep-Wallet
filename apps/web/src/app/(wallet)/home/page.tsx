"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Brand";
import { LockIcon, PlusIcon, ReceiveIcon, SendIcon, ShieldIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { TabBar } from "@/components/TabBar";
import { config } from "@/lib/config";
import { formatMusd } from "@/lib/format";
import { loadHistory, type HistoryItem } from "@/lib/storage";
import { useAccountState } from "@/lib/use-account-state";
import { useWallet } from "@/lib/wallet";
import { HistoryRow } from "@/components/HistoryRow";

function HomeScreen() {
  const { wallet } = useWallet();
  const { state, error, refresh, loading } = useAccountState(wallet?.account);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => setHistory(loadHistory().slice(0, 3)), []);

  const balance = state?.balance ?? 0n;
  const spendable = state ? (state.remainingToday < balance ? state.remainingToday : balance) : 0n;
  const protectedAmount = balance - spendable;

  return (
    <>
      <div className="screen with-tabs">
        <div className="row between" style={{ paddingTop: 8 }}>
          <Logo />
          {config.isTestnet && <span className="badge badge-amber">Mezo testnet</span>}
        </div>

        <section className="card stack" aria-label="Balance">
          <span className="muted small">Total balance</span>
          <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
            <span className="big-number">{state ? formatMusd(balance) : "—"}</span>
            <span className="muted" style={{ fontWeight: 500 }}>
              MUSD
            </span>
          </div>
          <span className="muted small">≈ ${state ? formatMusd(balance) : "—"} · backed by Bitcoin</span>
          <span className="badge" style={{ marginTop: 6 }}>
            <ShieldIcon /> Vault quantum-protected
          </span>
        </section>

        {error && (
          <div className="notice notice-error">
            <span>
              Couldn&apos;t reach Mezo.{" "}
              <button className="btn-link" onClick={refresh}>
                Retry
              </button>
            </span>
          </div>
        )}

        <nav className="actions" aria-label="Actions">
          <Link href="/send" className="action">
            <span style={{ color: "var(--mint)" }}>
              <SendIcon />
            </span>
            Send
          </Link>
          <Link href="/receive" className="action">
            <span style={{ color: "var(--mint)" }}>
              <ReceiveIcon />
            </span>
            Receive
          </Link>
          <Link href="/get-musd" className="action">
            <span style={{ color: "var(--mint)" }}>
              <PlusIcon />
            </span>
            Get MUSD
          </Link>
          <Link href="/security" className="action">
            <span style={{ color: "var(--mint)" }}>
              <LockIcon />
            </span>
            Vault
          </Link>
        </nav>

        <div className="pockets">
          <div className="card-outline stack" style={{ gap: 4 }}>
            <span className="muted tiny">Spendable today</span>
            <span className="pocket-amount">{state ? formatMusd(spendable) : "—"}</span>
            <span className="muted tiny">Daily key · {state ? formatMusd(state.dailyLimit, 0) : "—"}/day</span>
          </div>
          <div className="card-vault stack" style={{ gap: 4 }}>
            <span className="tiny" style={{ color: "var(--mint)" }}>
              Vault
            </span>
            <span className="pocket-amount">{state ? formatMusd(protectedAmount) : "—"}</span>
            <span className="muted tiny">Needs Vault Key</span>
          </div>
        </div>

        <section className="stack" style={{ gap: 4 }}>
          <div className="row between" style={{ paddingBottom: 6 }}>
            <strong style={{ fontSize: 15 }}>Recent on this device</strong>
            <Link href="/activity" className="small" style={{ textDecoration: "none" }}>
              See all
            </Link>
          </div>
          {history.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              {loading ? "Loading…" : "No activity yet. Receive MUSD to get started."}
            </p>
          ) : (
            history.map((h) => <HistoryRow key={h.hash} item={h} />)
          )}
        </section>
      </div>
      <TabBar />
    </>
  );
}

export default function HomePage() {
  return (
    <RequireWallet>
      <HomeScreen />
    </RequireWallet>
  );
}

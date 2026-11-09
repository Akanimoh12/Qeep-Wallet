"use client";

import {
  addCollCall,
  borrowMoreCall,
  closeTroveCall,
  collateralRatio,
  MCR,
  openTroveCall,
  openTroveDebt,
  repayCall,
  troveHints,
  TroveStatus,
} from "@qeep/sdk";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Hex } from "viem";
import { Header } from "@/components/Header";
import { HealthBar } from "@/components/HealthBar";
import { WarnIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { TxDone } from "@/components/TxDone";
import { VaultApproval } from "@/components/VaultApproval";
import { publicClient } from "@/lib/client";
import { btcToUsd, formatBtc, formatMusd, formatRatio, parseMusd } from "@/lib/format";
import { addHistory, type HistoryItem } from "@/lib/storage";
import { useAccountState } from "@/lib/use-account-state";
import { mezo, useMezoPosition, type MezoState } from "@/lib/use-mezo";
import { executeVaultAction } from "@/lib/vault";
import { useWallet } from "@/lib/wallet";

type Mode = "add" | "more" | "repay" | "close";

/** A reviewed loan action, ready for Vault Key approval. */
type Plan = {
  headline: string;
  detail: string;
  kind: HistoryItem["kind"];
  amount?: string;
  value: bigint;
  /** Collateral and debt after the action, for Mezo's sorted-list hints. */
  after: { coll: bigint; debt: bigint };
  data: (upper: `0x${string}`, lower: `0x${string}`) => Hex;
  doneTitle: string;
};

type Stage = { name: "form" } | { name: "approve"; plan: Plan } | { name: "done"; hash: string; plan: Plan };

const parseBtc = parseMusd; // both use 18 decimals

function BorrowScreen() {
  const { wallet } = useWallet();
  const { state: mz, refresh } = useMezoPosition(wallet?.account);
  const { state: acct, refresh: refreshAcct } = useAccountState(wallet?.account);
  const [stage, setStage] = useState<Stage>({ name: "form" });

  if (!wallet) return null;

  if (stage.name === "done") {
    return (
      <div className="screen">
        <TxDone title={stage.plan.doneTitle} detail={stage.plan.detail} hash={stage.hash} />
      </div>
    );
  }

  if (stage.name === "approve") {
    const { plan } = stage;
    return (
      <div className="screen">
        <Header title="Approve with Vault Key" back="/borrow" />
        <VaultApproval
          headline={plan.headline}
          detail={plan.detail}
          cta="Sign and submit to Mezo"
          onApprove={async (seed) => {
            const { upper, lower } = await troveHints(publicClient, mezo, plan.after.coll, plan.after.debt);
            const hash = await executeVaultAction({
              seed,
              account: wallet.account,
              target: mezo.borrowerOperations,
              value: plan.value,
              data: plan.data(upper, lower),
            });
            addHistory({ hash, kind: plan.kind, amount: plan.amount, at: Date.now() });
            refresh();
            refreshAcct();
            setStage({ name: "done", hash, plan });
          }}
        />
        <button className="btn btn-secondary btn-small" onClick={() => setStage({ name: "form" })}>
          Cancel
        </button>
      </div>
    );
  }

  const active = mz?.trove.status === TroveStatus.Active;
  const review = (plan: Plan) => setStage({ name: "approve", plan });

  return (
    <div className="screen">
      <Header title="Borrow on Mezo" />

      <section className="card stack">
        <div className="row between small">
          <span className="muted">BTC price (Mezo oracle)</span>
          <strong>${mz ? formatMusd(mz.price) : "—"}</strong>
        </div>
        <div className="row between small">
          <span className="muted">BTC in your Qeep account</span>
          <strong>{mz ? formatBtc(mz.btcBalance) : "—"} BTC</strong>
        </div>
        <div className="row between small">
          <span className="muted">MUSD in your Qeep account</span>
          <strong>{acct ? formatMusd(acct.balance) : "—"}</strong>
        </div>
        {mz?.recoveryMode && (
          <div className="notice notice-warn">
            <span style={{ color: "var(--amber)" }}>
              <WarnIcon />
            </span>
            <span>Mezo is in recovery mode. Keep your collateral ratio above 150%.</span>
          </div>
        )}
      </section>

      {!mz ? (
        <p className="muted small">Loading your Mezo position…</p>
      ) : active ? (
        <ActiveLoan mz={mz} musd={acct?.balance ?? 0n} onReview={review} />
      ) : (
        <OpenLoan mz={mz} onReview={review} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ open a loan

function OpenLoan({ mz, onReview }: { mz: MezoState; onReview: (p: Plan) => void }) {
  const [collText, setCollText] = useState("");
  const [borrowText, setBorrowText] = useState("");
  const [totalDebt, setTotalDebt] = useState<bigint | null>(null);

  const coll = parseBtc(collText);
  const borrow = parseMusd(borrowText);

  useEffect(() => {
    setTotalDebt(null);
    if (!borrow) return;
    let live = true;
    const t = setTimeout(() => {
      openTroveDebt(publicClient, mezo, borrow).then((d) => live && setTotalDebt(d));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [borrow]);

  const ratio = coll && totalDebt ? collateralRatio(coll, totalDebt, mz.price) : null;
  const errors: string[] = [];
  if (coll && coll > mz.btcBalance) errors.push("That is more BTC than your Qeep account holds.");
  if (borrow && borrow < mz.minNetDebt) errors.push(`Mezo's minimum loan is ${formatMusd(mz.minNetDebt, 0)} MUSD.`);
  if (ratio !== null && ratio < MCR) errors.push("Collateral ratio must be at least 110%. Add BTC or borrow less.");
  const ok = coll && borrow && totalDebt && ratio !== null && errors.length === 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    onReview({
      headline: `Borrow ${formatMusd(borrow)} MUSD`,
      detail: `against ${formatBtc(coll)} BTC · ratio ${formatRatio(ratio)}`,
      kind: "borrow",
      amount: formatMusd(borrow),
      value: coll,
      after: { coll, debt: totalDebt },
      data: (u, l) => openTroveCall(borrow, u, l),
      doneTitle: "Loan opened",
    });
  }

  return (
    <form className="stack-lg" onSubmit={onSubmit}>
      <div className="stack">
        <h2 className="h2">Borrow MUSD against BTC</h2>
        <p className="lead small">
          Lock BTC from your Qeep account as collateral and mint MUSD at a fixed rate. Your Vault Key approves it.
        </p>
      </div>

      {mz.btcBalance === 0n && (
        <div className="notice notice-warn">
          <span>
            Send BTC to your Qeep account first. <Link href="/receive">Show my address</Link>
          </span>
        </div>
      )}

      <div className="stack">
        <label htmlFor="coll" className="label">
          Collateral (BTC)
        </label>
        <input
          id="coll"
          className="input"
          inputMode="decimal"
          placeholder="0.05"
          value={collText}
          onChange={(e) => setCollText(e.target.value)}
        />
        <span className="muted tiny">≈ ${coll ? formatMusd(btcToUsd(coll, mz.price)) : "0.00"}</span>
      </div>

      <div className="stack">
        <label htmlFor="borrow" className="label">
          Borrow (MUSD)
        </label>
        <input
          id="borrow"
          className="input"
          inputMode="decimal"
          placeholder={formatMusd(mz.minNetDebt, 0).replace(/,/g, "")}
          value={borrowText}
          onChange={(e) => setBorrowText(e.target.value)}
        />
        <span className="muted tiny">Minimum {formatMusd(mz.minNetDebt, 0)} MUSD.</span>
      </div>

      {ratio !== null && (
        <section className="card stack-lg">
          <HealthBar ratio={ratio} />
          <div className="stat-grid small">
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted tiny">Total debt</span>
              <span className="v">{formatMusd(totalDebt!)}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted tiny">Liquidation price</span>
              <span className="v">${formatMusd((totalDebt! * MCR) / coll!)}</span>
            </div>
          </div>
          <span className="muted tiny">
            Total debt includes Mezo&apos;s borrowing fee and a {formatMusd(mz.gasCompensation, 0)} MUSD gas deposit
            that is returned when you close the loan.
          </span>
        </section>
      )}

      {errors.map((e) => (
        <div key={e} className="notice notice-error">
          {e}
        </div>
      ))}

      <button className="btn btn-primary" disabled={!ok}>
        Review and approve
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ manage an open loan

function ActiveLoan({ mz, musd, onReview }: { mz: MezoState; musd: bigint; onReview: (p: Plan) => void }) {
  const [mode, setMode] = useState<Mode>("add");
  const [text, setText] = useState("");
  const { trove } = mz;
  const amount = parseMusd(text);

  // Debt left after repaying must stay at Mezo's minimum plus the gas deposit.
  const floor = mz.minNetDebt + mz.gasCompensation;
  const maxRepay = trove.debt > floor ? (trove.debt - floor < musd ? trove.debt - floor : musd) : 0n;
  const closeNeeds = trove.debt - mz.gasCompensation;

  let after: { coll: bigint; debt: bigint } | null = null;
  let error: string | null = null;
  if (mode === "add" && amount) {
    after = { coll: trove.coll + amount, debt: trove.debt };
    if (amount > mz.btcBalance) error = "That is more BTC than your Qeep account holds.";
  } else if (mode === "more" && amount) {
    after = { coll: trove.coll, debt: trove.debt + amount };
    if (collateralRatio(after.coll, after.debt, mz.price) < MCR) error = "That would take the loan below 110%.";
  } else if (mode === "repay" && amount) {
    after = { coll: trove.coll, debt: trove.debt - amount };
    if (amount > maxRepay) error = `You can repay up to ${formatMusd(maxRepay)} MUSD now.`;
  }
  const newRatio = after ? collateralRatio(after.coll, after.debt, mz.price) : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "close") {
      onReview({
        headline: "Close loan",
        detail: `Repay ${formatMusd(closeNeeds)} MUSD · get ${formatBtc(trove.coll)} BTC back`,
        kind: "loan-closed",
        value: 0n,
        after: { coll: 0n, debt: 0n },
        data: () => closeTroveCall(),
        doneTitle: "Loan closed",
      });
      return;
    }
    if (!amount || !after || error) return;
    const ratioText = formatRatio(newRatio!);
    if (mode === "add") {
      onReview({
        headline: `Add ${formatBtc(amount)} BTC`,
        detail: `New collateral ratio ${ratioText}`,
        kind: "collateral",
        value: amount,
        after,
        data: (u, l) => addCollCall(u, l),
        doneTitle: "Collateral added",
      });
    } else if (mode === "more") {
      onReview({
        headline: `Borrow ${formatMusd(amount)} MUSD`,
        detail: `New collateral ratio ${ratioText}`,
        kind: "borrow",
        amount: formatMusd(amount),
        value: 0n,
        after,
        data: (u, l) => borrowMoreCall(amount, u, l),
        doneTitle: "Borrowed",
      });
    } else {
      onReview({
        headline: `Repay ${formatMusd(amount)} MUSD`,
        detail: `New collateral ratio ${ratioText}`,
        kind: "repay",
        amount: formatMusd(amount),
        value: 0n,
        after,
        data: (u, l) => repayCall(amount, u, l),
        doneTitle: "Repaid",
      });
    }
  }

  return (
    <div className="stack-lg">
      <section className="card stack-lg">
        <div className="row between">
          <strong>Your Mezo loan</strong>
          <span className="badge">{(trove.interestRateBps / 100).toFixed(2)}% fixed</span>
        </div>
        <HealthBar ratio={trove.icr} />
        <div className="stat-grid">
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">Collateral</span>
            <span className="v">{formatBtc(trove.coll)} BTC</span>
            <span className="muted tiny">≈ ${formatMusd(btcToUsd(trove.coll, mz.price))}</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">Debt</span>
            <span className="v">{formatMusd(trove.debt)}</span>
            <span className="muted tiny">MUSD incl. interest</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">Liquidation price</span>
            <span className="v">${formatMusd(trove.liquidationPrice)}</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">BTC can fall</span>
            <span className="v">
              {mz.price > 0n ? `${(100 - Number((trove.liquidationPrice * 10000n) / mz.price) / 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>
      </section>

      <div className="segmented" role="tablist">
        {(
          [
            ["add", "Add BTC"],
            ["more", "Borrow"],
            ["repay", "Repay"],
            ["close", "Close"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "on" : ""}
            onClick={() => {
              setMode(m);
              setText("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="stack-lg" onSubmit={onSubmit}>
        {mode === "close" ? (
          <div className="card stack small">
            <div className="row between">
              <span className="muted">MUSD needed</span>
              <strong>{formatMusd(closeNeeds)}</strong>
            </div>
            <div className="row between">
              <span className="muted">MUSD you hold</span>
              <strong>{formatMusd(musd)}</strong>
            </div>
            <div className="row between">
              <span className="muted">BTC returned</span>
              <strong>{formatBtc(trove.coll)} BTC</strong>
            </div>
            {musd < closeNeeds && (
              <div className="notice notice-error">
                You need {formatMusd(closeNeeds - musd)} more MUSD in your Qeep account to close this loan.
              </div>
            )}
          </div>
        ) : (
          <div className="stack">
            <label htmlFor="loan-amount" className="label">
              {mode === "add" ? "BTC to add" : mode === "more" ? "MUSD to borrow" : "MUSD to repay"}
            </label>
            <input
              id="loan-amount"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="muted tiny">
              {mode === "add"
                ? `Available ${formatBtc(mz.btcBalance)} BTC`
                : mode === "repay"
                  ? `Up to ${formatMusd(maxRepay)} MUSD (Mezo keeps a ${formatMusd(mz.minNetDebt, 0)} MUSD minimum)`
                  : "Paid into your Qeep account"}
            </span>
          </div>
        )}

        {newRatio !== null && !error && <HealthBar ratio={newRatio} />}
        {error && <div className="notice notice-error">{error}</div>}

        <button
          className="btn btn-primary"
          disabled={mode === "close" ? musd < closeNeeds : !amount || !!error}
        >
          Review and approve
        </button>
      </form>
    </div>
  );
}

export default function BorrowPage() {
  return (
    <RequireWallet>
      <BorrowScreen />
    </RequireWallet>
  );
}

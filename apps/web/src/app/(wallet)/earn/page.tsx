"use client";

import { approveCall, provideToSPCall, stabilityPoolAbi, withdrawFromSPCall } from "@qeep/sdk";
import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { RequireWallet } from "@/components/RequireWallet";
import { TxDone } from "@/components/TxDone";
import { VaultApproval } from "@/components/VaultApproval";
import { publicClient } from "@/lib/client";
import { formatBtc, formatMusd, parseMusd } from "@/lib/format";
import { addHistory } from "@/lib/storage";
import { useAccountState } from "@/lib/use-account-state";
import { mezo, useMezoPosition } from "@/lib/use-mezo";
import { executeVaultAction } from "@/lib/vault";
import { useWallet } from "@/lib/wallet";

type Mode = "deposit" | "withdraw";
type Stage = { name: "form" } | { name: "approve"; mode: Mode; amount: bigint } | { name: "done"; hash: string; mode: Mode; amount: bigint };

function EarnScreen() {
  const { wallet } = useWallet();
  const { state: mz, refresh } = useMezoPosition(wallet?.account);
  const { state: acct, refresh: refreshAcct } = useAccountState(wallet?.account);
  const [mode, setMode] = useState<Mode>("deposit");
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "form" });
  const [poolTotal, setPoolTotal] = useState<bigint | null>(null);

  useEffect(() => {
    publicClient
      .readContract({ address: mezo.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" })
      .then(setPoolTotal)
      .catch(() => {});
  }, [stage.name]);

  if (!wallet) return null;

  if (stage.name === "done") {
    return (
      <div className="screen">
        <TxDone
          title={stage.mode === "deposit" ? "Deposited" : "Withdrawn"}
          detail={`${formatMusd(stage.amount)} MUSD ${stage.mode === "deposit" ? "now earning in the Stability Pool" : "back in your Qeep account"}`}
          hash={stage.hash}
        />
      </div>
    );
  }

  if (stage.name === "approve" && mz) {
    const needsAllowance = stage.mode === "deposit" && mz.spAllowance < stage.amount;
    return (
      <div className="screen">
        <Header title="Approve with Vault Key" back="/earn" />
        <VaultApproval
          headline={`${stage.mode === "deposit" ? "Deposit" : "Withdraw"} ${formatMusd(stage.amount)} MUSD`}
          detail={
            needsAllowance
              ? "Mezo Stability Pool · first deposit also allows the pool to use your MUSD (2 one-time keys)"
              : "Mezo Stability Pool"
          }
          cta="Sign and submit to Mezo"
          onApprove={async (seed) => {
            if (needsAllowance) {
              const approveHash = await executeVaultAction({
                seed,
                account: wallet.account,
                target: mezo.musd,
                data: approveCall(mezo.stabilityPool),
              });
              addHistory({ hash: approveHash, kind: "approve", at: Date.now() });
            }
            const hash = await executeVaultAction({
              seed,
              account: wallet.account,
              target: mezo.stabilityPool,
              data: stage.mode === "deposit" ? provideToSPCall(stage.amount) : withdrawFromSPCall(stage.amount),
            });
            addHistory({
              hash,
              kind: stage.mode === "deposit" ? "sp-deposit" : "sp-withdraw",
              amount: formatMusd(stage.amount),
              at: Date.now(),
            });
            refresh();
            refreshAcct();
            setStage({ name: "done", hash, mode: stage.mode, amount: stage.amount });
          }}
        />
        <button className="btn btn-secondary btn-small" onClick={() => setStage({ name: "form" })}>
          Cancel
        </button>
      </div>
    );
  }

  const amount = parseMusd(text);
  const max = mode === "deposit" ? (acct?.balance ?? 0n) : (mz?.stabilityPool.deposit ?? 0n);
  const error = amount && amount > max ? `You can ${mode} up to ${formatMusd(max)} MUSD.` : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount && !error) setStage({ name: "approve", mode, amount });
  }

  return (
    <div className="screen">
      <Header title="Earn on Mezo" />

      <section className="card-vault stack-lg">
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny" style={{ color: "var(--mint)" }}>
            Your Stability Pool deposit
          </span>
          <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
            <span className="big-number">{mz ? formatMusd(mz.stabilityPool.deposit) : "—"}</span>
            <span className="muted">MUSD</span>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">BTC earned</span>
            <span className="v">{mz ? formatBtc(mz.stabilityPool.btcGain, 8) : "—"}</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted tiny">Pool size</span>
            <span className="v">{poolTotal !== null ? formatMusd(poolTotal, 0) : "—"}</span>
          </div>
        </div>
      </section>

      <p className="lead small" style={{ margin: 0 }}>
        Your MUSD backs Mezo loans. When a loan is liquidated, the pool repays its debt and depositors receive its BTC
        collateral at a discount. Deposits and withdrawals are approved with your post-quantum Vault Key.
      </p>

      <div className="segmented" role="tablist">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "on" : ""}
            onClick={() => {
              setMode(m);
              setText("");
            }}
          >
            {m === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      <form className="stack-lg" onSubmit={onSubmit}>
        <div className="card stack" style={{ alignItems: "center" }}>
          <label htmlFor="sp-amount" className="label">
            Amount (MUSD)
          </label>
          <input
            id="sp-amount"
            className="amount-input"
            inputMode="decimal"
            placeholder="0.00"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="muted small">
            {mode === "deposit" ? "In your account" : "Deposited"} {formatMusd(max)} ·{" "}
            <button type="button" className="btn-link" onClick={() => setText(formatMusd(max, 18).replace(/,/g, ""))}>
              Max
            </button>
          </span>
        </div>
        {mode === "withdraw" && mz && mz.stabilityPool.btcGain > 0n && (
          <span className="muted tiny">Withdrawing also sends your BTC gains to your Qeep account.</span>
        )}
        {error && <div className="notice notice-error">{error}</div>}
        <div className="spacer" />
        <button className="btn btn-primary" disabled={!amount || !!error || !mz}>
          Review and approve
        </button>
      </form>
    </div>
  );
}

export default function EarnPage() {
  return (
    <RequireWallet>
      <EarnScreen />
    </RequireWallet>
  );
}

"use client";

import { setDailyLimitCall } from "@qeep/sdk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ExternalIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { TabBar } from "@/components/TabBar";
import { TxDone } from "@/components/TxDone";
import { VaultApproval } from "@/components/VaultApproval";
import { explorerAddress } from "@/lib/config";
import { formatMusd, parseMusd, shortAddress } from "@/lib/format";
import { addHistory } from "@/lib/storage";
import { useAccountState } from "@/lib/use-account-state";
import { executeVaultAction } from "@/lib/vault";
import { useWallet } from "@/lib/wallet";

type Stage = { name: "view" } | { name: "limit"; value: bigint } | { name: "done"; hash: string; value: bigint };

function SecurityScreen() {
  const router = useRouter();
  const { wallet, signer, lock, forget } = useWallet();
  const { state } = useAccountState(wallet?.account);
  const [limitText, setLimitText] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "view" });

  if (!wallet) return null;

  if (stage.name === "done") {
    return (
      <div className="screen">
        <TxDone
          title="Limit updated"
          detail={`Your Daily key can now send ${formatMusd(stage.value)} MUSD per day.`}
          hash={stage.hash}
        />
      </div>
    );
  }

  if (stage.name === "limit") {
    return (
      <div className="screen">
        <h1 className="h2" style={{ paddingTop: 8 }}>
          Change daily limit
        </h1>
        <VaultApproval
          headline={`${formatMusd(stage.value)} MUSD/day`}
          detail="New Daily key limit"
          cta="Sign and update"
          onApprove={async (seed) => {
            const hash = await executeVaultAction({
              seed,
              account: wallet.account,
              target: wallet.account,
              data: setDailyLimitCall(stage.value),
            });
            addHistory({ hash, kind: "limit", at: Date.now() });
            setStage({ name: "done", hash, value: stage.value });
          }}
        />
        <button className="btn btn-secondary btn-small" onClick={() => setStage({ name: "view" })}>
          Cancel
        </button>
      </div>
    );
  }

  function onLimit(e: FormEvent) {
    e.preventDefault();
    const value = parseMusd(limitText);
    if (value) setStage({ name: "limit", value });
  }

  return (
    <>
      <div className="screen with-tabs">
        <h1 className="h1" style={{ paddingTop: 8 }}>
          Security
        </h1>

        <section className="card stack-lg">
          <div className="row between small">
            <span className="muted">Qeep account</span>
            <a
              href={explorerAddress(wallet.account)}
              target="_blank"
              rel="noreferrer"
              className="row"
              style={{ gap: 4 }}
            >
              {shortAddress(wallet.account)} <ExternalIcon />
            </a>
          </div>
          <div className="row between small">
            <span className="muted">Daily key</span>
            <span>
              {shortAddress(wallet.owner)} · {signer ? "unlocked" : "locked"}
            </span>
          </div>
          <div className="row between small">
            <span className="muted">Daily limit</span>
            <span>{state ? `${formatMusd(state.dailyLimit)} MUSD` : "—"}</span>
          </div>
          <div className="row between small">
            <span className="muted">Vault Keys used</span>
            <span>{state ? state.vaultNonce.toString() : "—"}</span>
          </div>
        </section>

        <section className="card-vault stack">
          <strong style={{ color: "var(--mint)" }}>How your Vault is protected</strong>
          <p className="small" style={{ margin: 0, lineHeight: 1.55, color: "var(--text-2)" }}>
            Anything above your daily limit needs a Winternitz one-time signature from your 24-word Vault Key. It relies
            only on hashing, which quantum computers can&apos;t break the way they break the ECDSA keys most wallets
            use. Each key signs once, then your account moves to the next one.
          </p>
        </section>

        <form className="stack" onSubmit={onLimit}>
          <label htmlFor="new-limit" className="label">
            New daily limit (MUSD)
          </label>
          <div className="row">
            <input
              id="new-limit"
              className="input"
              inputMode="decimal"
              placeholder={state ? formatMusd(state.dailyLimit).replace(/,/g, "") : "500"}
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
            />
            <button className="btn btn-primary btn-small" style={{ width: 120 }} disabled={!parseMusd(limitText)}>
              Change
            </button>
          </div>
          <span className="muted tiny">Needs your Vault Key.</span>
        </form>

        {signer && (
          <button className="btn btn-secondary btn-small" onClick={lock}>
            Lock Daily key
          </button>
        )}
        <button
          className="btn btn-danger btn-small"
          onClick={() => {
            if (confirm("Remove this wallet from this device? You will need your Vault Key phrase to restore it.")) {
              forget();
              router.replace("/start");
            }
          }}
        >
          Remove wallet from this device
        </button>
      </div>
      <TabBar />
    </>
  );
}

export default function SecurityPage() {
  return (
    <RequireWallet>
      <SecurityScreen />
    </RequireWallet>
  );
}

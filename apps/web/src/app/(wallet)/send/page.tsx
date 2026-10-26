"use client";

import { musdTransferCall, qeepAccountAbi, spendDigest } from "@qeep/sdk";
import { useState, type FormEvent } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { Header } from "@/components/Header";
import { BackIcon, WarnIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { Spinner } from "@/components/Spinner";
import { TxDone } from "@/components/TxDone";
import { UnlockForm } from "@/components/UnlockForm";
import { VaultApproval } from "@/components/VaultApproval";
import { publicClient } from "@/lib/client";
import { config } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { formatMusd, parseMusd, shortAddress } from "@/lib/format";
import { relay } from "@/lib/relay";
import { addHistory } from "@/lib/storage";
import { useAccountState } from "@/lib/use-account-state";
import { executeVaultAction } from "@/lib/vault";
import { useWallet } from "@/lib/wallet";

type Stage =
  | { name: "form" }
  | { name: "vault"; to: Address; amount: bigint }
  | { name: "done"; hash: string; to: Address; amount: bigint };

function SendScreen() {
  const { wallet, signer } = useWallet();
  const { state } = useAccountState(wallet?.account);
  const [to, setTo] = useState("");
  const [amountText, setAmountText] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "form" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseMusd(amountText);
  const balance = state?.balance ?? 0n;
  const remaining = state?.remainingToday ?? 0n;
  const needsVault = amount !== null && amount > remaining;
  const overBalance = amount !== null && amount > balance;
  const validTo = isAddress(to.trim());

  async function sendWithDailyKey(recipient: Address, value: bigint) {
    if (!wallet || !signer) return;
    setBusy(true);
    setError(null);
    try {
      const nonce = await publicClient.readContract({
        address: wallet.account,
        abi: qeepAccountAbi,
        functionName: "spendNonce",
      });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      const digest = spendDigest({
        chainId: config.chainId,
        account: wallet.account,
        nonce,
        to: recipient,
        amount: value,
        deadline,
      });
      const signature = await signer.signMessage({ message: { raw: digest } });
      const { hash } = await relay({
        action: "spend",
        account: wallet.account,
        to: recipient,
        amount: value.toString(),
        deadline: deadline.toString(),
        signature,
      });
      addHistory({ hash, kind: "sent", amount: formatMusd(value), to: recipient, at: Date.now() });
      setStage({ name: "done", hash, to: recipient, amount: value });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || !validTo || overBalance) return;
    const recipient = getAddress(to.trim());
    if (needsVault) setStage({ name: "vault", to: recipient, amount });
    else sendWithDailyKey(recipient, amount);
  }

  if (stage.name === "done") {
    return (
      <div className="screen">
        <TxDone
          title="Sent"
          detail={`${formatMusd(stage.amount)} MUSD to ${shortAddress(stage.to)}`}
          hash={stage.hash}
        />
      </div>
    );
  }

  if (stage.name === "vault" && wallet) {
    return (
      <div className="screen">
        <div className="header">
          <button className="icon-btn" aria-label="Back" onClick={() => setStage({ name: "form" })}>
            <BackIcon />
          </button>
          <h1 className="h2">Approve with Vault Key</h1>
        </div>
        <VaultApproval
          headline={`${formatMusd(stage.amount)} MUSD`}
          detail={`to ${shortAddress(stage.to)}`}
          onApprove={async (seed) => {
            const hash = await executeVaultAction({
              seed,
              account: wallet.account,
              target: config.musd,
              data: musdTransferCall(stage.to, stage.amount),
            });
            addHistory({ hash, kind: "vault-sent", amount: formatMusd(stage.amount), to: stage.to, at: Date.now() });
            setStage({ name: "done", hash, to: stage.to, amount: stage.amount });
          }}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Send MUSD" />
      <form id="send-form" className="stack-lg" style={{ gap: 20 }} onSubmit={onSubmit}>
        <div className="stack">
          <label htmlFor="to" className="label">
            To
          </label>
          <input
            id="to"
            className="input"
            placeholder="0x… Mezo address"
            autoComplete="off"
            spellCheck={false}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {to.length > 0 && !validTo && (
            <span className="tiny" style={{ color: "var(--danger)" }}>
              Not a valid address
            </span>
          )}
        </div>

        <div className="card stack" style={{ alignItems: "center" }}>
          <label htmlFor="amount" className="label">
            Amount (MUSD)
          </label>
          <input
            id="amount"
            className="amount-input"
            inputMode="decimal"
            placeholder="0.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
          <span className="muted small">
            Available {state ? formatMusd(balance) : "—"} ·{" "}
            <button
              type="button"
              className="btn-link"
              onClick={() => state && setAmountText(formatMusd(balance, 18).replace(/,/g, ""))}
            >
              Max
            </button>
          </span>
        </div>

        {overBalance && <div className="notice notice-error">That is more than your balance.</div>}

        {needsVault && !overBalance && (
          <div className="notice notice-warn">
            <span style={{ color: "var(--amber)" }}>
              <WarnIcon />
            </span>
            <span>
              <strong>Vault Key approval needed.</strong>
              <br />
              This is above what your Daily key can send today ({formatMusd(remaining)} MUSD left), so it needs your
              post-quantum Vault Key.
            </span>
          </div>
        )}

        <div className="stack small" style={{ gap: 12 }}>
          <div className="row between">
            <span className="muted">Signed with</span>
            <span>{needsVault ? "Vault Key (post-quantum)" : "Daily key"}</span>
          </div>
          <div className="row between">
            <span className="muted">Network</span>
            <span>{config.isTestnet ? "Mezo testnet" : "Mezo"}</span>
          </div>
          <div className="row between">
            <span className="muted">Network fee</span>
            <span style={{ color: "var(--mint)" }}>Sponsored by Qeep</span>
          </div>
        </div>
      </form>

      {!needsVault && amount && !signer && <UnlockForm reason="Enter your password to sign with your Daily key." />}

      {error && <div className="notice notice-error">{error}</div>}

      <div className="spacer" />
      <button
        form="send-form"
        className="btn btn-primary"
        disabled={!amount || !validTo || overBalance || busy || !state || (!needsVault && !signer)}
      >
        {busy ? <Spinner /> : needsVault ? "Review and approve" : "Send"}
      </button>
    </div>
  );
}

export default function SendPage() {
  return (
    <RequireWallet>
      <SendScreen />
    </RequireWallet>
  );
}

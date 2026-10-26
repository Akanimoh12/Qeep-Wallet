"use client";

import { isValidVaultPhrase, vaultSeedFromPhrase } from "@qeep/sdk";
import { useState, type FormEvent } from "react";
import type { Hex } from "viem";
import { friendlyError } from "@/lib/errors";
import { ShieldCheckIcon } from "./Icons";
import { Spinner } from "./Spinner";

const STEPS = [
  {
    title: "Post-quantum signature",
    sub: "Signed with a Winternitz one-time signature (WOTS), a hash-based scheme quantum computers can't forge.",
  },
  { title: "One-time key", sub: "This key is used once. Your account then switches to the next key automatically." },
  { title: "Checked on-chain", sub: "Your Qeep account on Mezo verifies the signature before anything moves." },
];

/**
 * The Vault Key approval step. The 24 words are used in this browser to sign, then cleared.
 * `onApprove` receives the 32-byte vault seed and performs the action.
 */
export function VaultApproval({
  headline,
  detail,
  cta = "Sign and send",
  onApprove,
}: {
  headline: string;
  detail: string;
  cta?: string;
  onApprove: (seed: Hex) => Promise<void>;
}) {
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVaultPhrase(phrase)) {
      setError("That isn't a valid 24-word Vault Key. Check the spelling and order.");
      return;
    }
    setBusy(true);
    try {
      // Yield a frame so the spinner renders before the CPU-heavy signing.
      await new Promise((r) => setTimeout(r, 30));
      const seed = vaultSeedFromPhrase(phrase);
      setPhrase("");
      await onApprove(seed);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack-lg">
      <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: "4px 0" }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 26,
            background: "var(--mint-soft)",
            color: "var(--mint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheckIcon size={40} />
        </div>
        <span className="h2" style={{ fontSize: 28 }}>
          {headline}
        </span>
        <span className="muted small">{detail}</span>
      </div>

      <ol className="card stack-lg" style={{ listStyle: "none", margin: 0, padding: 18 }}>
        {STEPS.map((s, i) => (
          <li key={s.title} className="row" style={{ alignItems: "flex-start" }}>
            <span
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderRadius: 999,
                background: "var(--mint-soft)",
                color: "var(--mint)",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <strong className="small">{s.title}</strong>
              <span className="muted small" style={{ lineHeight: 1.45 }}>
                {s.sub}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="stack">
        <label htmlFor="vault-phrase" className="label">
          Vault Key phrase
        </label>
        <textarea
          id="vault-phrase"
          className="textarea"
          placeholder="Enter your 24 words"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
        />
        <span className="muted tiny">
          Signed on this device. Your words never leave it and are cleared after signing.
        </span>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <button className="btn btn-primary" disabled={busy || phrase.trim().length === 0}>
        {busy ? (
          <>
            <Spinner /> Signing and sending…
          </>
        ) : (
          cta
        )}
      </button>
    </form>
  );
}

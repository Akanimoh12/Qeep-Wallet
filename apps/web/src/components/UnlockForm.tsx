"use client";

import { useState, type FormEvent } from "react";
import { useWallet } from "@/lib/wallet";
import { LockIcon } from "./Icons";
import { Spinner } from "./Spinner";

/** Asks for the password that decrypts the Daily key on this device. */
export function UnlockForm({ reason }: { reason: string }) {
  const { unlock } = useWallet();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card stack-lg">
      <div className="row" style={{ color: "var(--mint)" }}>
        <LockIcon />
        <strong style={{ color: "var(--text)" }}>Unlock Qeep</strong>
      </div>
      <p className="lead small">{reason}</p>
      <div className="stack">
        <label htmlFor="unlock-password" className="label">
          Password
        </label>
        <input
          id="unlock-password"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <button className="btn btn-primary" disabled={busy || password.length === 0}>
        {busy ? <Spinner /> : "Unlock"}
      </button>
    </form>
  );
}

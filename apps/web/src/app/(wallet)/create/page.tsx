"use client";

import { createVaultPhrase, firstVaultKeyHash, vaultSeedFromPhrase } from "@qeep/sdk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Header } from "@/components/Header";
import { PhraseGrid } from "@/components/PhraseGrid";
import { Spinner } from "@/components/Spinner";
import { config } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { parseMusd } from "@/lib/format";
import { relay } from "@/lib/relay";
import { addHistory, encryptSecret } from "@/lib/storage";
import { useWallet } from "@/lib/wallet";

type Step = "password" | "backup" | "creating";

export default function CreateWallet() {
  const router = useRouter();
  const { setWallet } = useWallet();

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [limit, setLimit] = useState<string>(config.defaultDailyLimit);
  const [dailyKey, setDailyKey] = useState<Hex | null>(null);
  const [phrase, setPhrase] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    if (!parseMusd(limit)) return setError("Enter a daily limit in MUSD, for example 500.");
    setDailyKey(generatePrivateKey());
    setPhrase(createVaultPhrase());
    setStep("backup");
  }

  async function onCreate() {
    if (!dailyKey) return;
    setError(null);
    setStep("creating");
    try {
      await new Promise((r) => setTimeout(r, 30));
      const signer = privateKeyToAccount(dailyKey);
      const firstKeyHash = firstVaultKeyHash(vaultSeedFromPhrase(phrase));

      const { hash, account } = await relay({
        action: "create",
        owner: signer.address,
        firstVaultKeyHash: firstKeyHash,
        dailyLimit: parseMusd(limit)!.toString(),
      });
      if (!account) throw new Error("Relayer did not return the account address.");

      setWallet(
        {
          version: 1,
          account,
          owner: signer.address,
          encryptedKey: await encryptSecret(dailyKey, password),
          createdAt: Date.now(),
        },
        signer,
      );
      addHistory({ hash, kind: "created", at: Date.now() });
      setPhrase("");
      setDailyKey(null);
      router.replace("/home");
    } catch (err) {
      setError(friendlyError(err));
      setStep("backup");
    }
  }

  if (step === "password") {
    return (
      <form className="screen" onSubmit={onPassword}>
        <Header title="Create wallet" back="/start" />
        <div className="stack">
          <span className="muted small">Step 1 of 2</span>
          <h2 className="h1">Set up this device</h2>
          <p className="lead">
            Your password unlocks the Daily key on this device for everyday sends. Qeep never sees it.
          </p>
        </div>
        <div className="stack">
          <label htmlFor="pw" className="label">
            Password
          </label>
          <input
            id="pw"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="stack">
          <label htmlFor="pw2" className="label">
            Confirm password
          </label>
          <input
            id="pw2"
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="stack">
          <label htmlFor="limit" className="label">
            Daily spending limit (MUSD)
          </label>
          <input
            id="limit"
            inputMode="decimal"
            className="input"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <span className="muted tiny">Sends above this need your Vault Key. You can change it later.</span>
        </div>
        {error && <div className="notice notice-error">{error}</div>}
        <div className="spacer" />
        <button className="btn btn-primary">Continue</button>
      </form>
    );
  }

  return (
    <div className="screen">
      <Header title="Back up Vault Key" back="/start" />
      <div className="stack">
        <span className="muted small">Step 2 of 2</span>
        <h2 className="h1">Save your Vault Key</h2>
        <p className="lead">
          These 24 words approve big sends, limit changes and recovery. They use post-quantum signatures. Write them
          down and keep them offline. Qeep does not store them.
        </p>
      </div>

      <PhraseGrid phrase={phrase} hidden={!revealed} />

      <button type="button" className="btn btn-secondary btn-small" onClick={() => setRevealed((v) => !v)}>
        {revealed ? "Hide words" : "Tap to reveal"}
      </button>

      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I wrote all 24 words down
        and stored them somewhere safe. Qeep can&apos;t recover them for me.
      </label>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="spacer" />
      <button className="btn btn-primary" disabled={!saved || step === "creating"} onClick={onCreate}>
        {step === "creating" ? (
          <>
            <Spinner /> Creating your account on Mezo…
          </>
        ) : (
          "Create my wallet"
        )}
      </button>
    </div>
  );
}

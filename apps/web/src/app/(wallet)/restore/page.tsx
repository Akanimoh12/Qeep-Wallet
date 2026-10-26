"use client";

import { firstVaultKeyHash, isValidVaultPhrase, qeepFactoryAbi, setOwnerCall, vaultSeedFromPhrase } from "@qeep/sdk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { publicClient } from "@/lib/client";
import { config } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { addHistory, encryptSecret } from "@/lib/storage";
import { executeVaultAction } from "@/lib/vault";
import { useWallet } from "@/lib/wallet";

/**
 * Restore on a new device: the 24 words find the account through the factory registry,
 * then a Vault Key action makes a fresh Daily key on this device the new owner.
 */
export default function RestoreWallet() {
  const router = useRouter();
  const { setWallet } = useWallet();
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVaultPhrase(phrase)) return setError("That isn't a valid 24-word Vault Key.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");

    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const seed = vaultSeedFromPhrase(phrase);
      setPhrase("");

      const account = await publicClient.readContract({
        address: config.factory,
        abi: qeepFactoryAbi,
        functionName: "accountOf",
        args: [firstVaultKeyHash(seed)],
      });
      if (account === zeroAddress) throw new Error("No Qeep account was found for this Vault Key.");

      const dailyKey = generatePrivateKey();
      const signer = privateKeyToAccount(dailyKey);
      const hash = await executeVaultAction({ seed, account, target: account, data: setOwnerCall(signer.address) });

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
      addHistory({ hash, kind: "restore", at: Date.now() });
      router.replace("/home");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={onSubmit}>
      <Header title="Restore wallet" back="/start" />
      <p className="lead">
        Enter your 24-word Vault Key. Qeep finds your account and sets up a new Daily key on this device. Your old
        device stops working for daily sends.
      </p>
      <div className="stack">
        <label htmlFor="phrase" className="label">
          Vault Key phrase
        </label>
        <textarea
          id="phrase"
          className="textarea"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Enter your 24 words"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
        />
      </div>
      <div className="stack">
        <label htmlFor="pw" className="label">
          New password for this device
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
      {error && <div className="notice notice-error">{error}</div>}
      <div className="spacer" />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? (
          <>
            <Spinner /> Restoring…
          </>
        ) : (
          "Restore wallet"
        )}
      </button>
    </form>
  );
}

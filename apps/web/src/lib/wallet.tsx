"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { qeepAccountAbi } from "@qeep/sdk";
import type { Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { publicClient } from "./client";
import { clearWallet, decryptSecret, loadWallet, saveWallet, type WalletRecord } from "./storage";

type WalletContextValue = {
  /** False until localStorage has been read on the client. */
  ready: boolean;
  wallet: WalletRecord | null;
  /** The decrypted Daily key, held in memory only while unlocked. */
  signer: PrivateKeyAccount | null;
  setWallet: (record: WalletRecord, signer?: PrivateKeyAccount) => void;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  forget: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [wallet, setWalletState] = useState<WalletRecord | null>(null);
  const [signer, setSigner] = useState<PrivateKeyAccount | null>(null);

  useEffect(() => {
    setWalletState(loadWallet());
    setReady(true);
  }, []);

  const setWallet = useCallback((record: WalletRecord, nextSigner?: PrivateKeyAccount) => {
    saveWallet(record);
    setWalletState(record);
    setSigner(nextSigner ?? null);
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      if (!wallet) throw new Error("No wallet on this device");
      const key = (await decryptSecret(wallet.encryptedKey, password)) as Hex;
      const account = privateKeyToAccount(key);
      // Compare with the owner on-chain: the wallet may have been restored on another device.
      const onchainOwner = await publicClient
        .readContract({ address: wallet.account, abi: qeepAccountAbi, functionName: "owner" })
        .catch(() => wallet.owner);
      if (account.address.toLowerCase() !== onchainOwner.toLowerCase()) {
        throw new Error("This Daily key no longer controls the account. Restore with your Vault Key.");
      }
      setSigner(account);
    },
    [wallet],
  );

  const lock = useCallback(() => setSigner(null), []);

  const forget = useCallback(() => {
    clearWallet();
    setWalletState(null);
    setSigner(null);
  }, []);

  const value = useMemo(
    () => ({ ready, wallet, signer, setWallet, unlock, lock, forget }),
    [ready, wallet, signer, setWallet, unlock, lock, forget],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

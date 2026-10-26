"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { CopyIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { config } from "@/lib/config";
import { useWallet } from "@/lib/wallet";

function ReceiveScreen() {
  const { wallet } = useWallet();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    QRCode.toDataURL(wallet.account, { margin: 0, width: 392, color: { dark: "#0d1117", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [wallet]);

  async function copy() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!wallet) return null;

  return (
    <div className="screen">
      <Header title="Receive MUSD" />
      <p className="lead">
        Share this address to receive MUSD on {config.isTestnet ? "Mezo testnet" : "Mezo"}. Only send MUSD on Mezo to
        this address.
      </p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code of your Qeep address" className="qr" />
      )}
      <div className="card stack">
        <span className="muted small">Your Qeep address</span>
        <span className="mono small">{wallet.account}</span>
      </div>
      <button className="btn btn-primary" onClick={copy}>
        <CopyIcon /> {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
}

export default function ReceivePage() {
  return (
    <RequireWallet>
      <ReceiveScreen />
    </RequireWallet>
  );
}

import Link from "next/link";
import { Header } from "@/components/Header";
import { QrIcon, SwapIcon } from "@/components/Icons";
import { config } from "@/lib/config";

export default function GetMusdPage() {
  return (
    <div className="screen">
      <Header title="Get MUSD" />
      <p className="lead">MUSD is a dollar stablecoin backed by Bitcoin. Pick how you want to get it.</p>

      <div className="stack-lg">
        <a href={config.mezoAppUrl} target="_blank" rel="noreferrer" className="option-card featured">
          <span
            className="option-icon"
            style={{ background: "#2a1f0b", color: "var(--btc)", fontSize: 20, fontWeight: 700 }}
          >
            ₿
          </span>
          <span className="stack" style={{ gap: 4, flex: 1 }}>
            <span className="row between">
              <strong>Borrow against BTC</strong>
              <span className="badge" style={{ background: "var(--mint)", color: "var(--bg)" }}>
                Best
              </span>
            </span>
            <span className="muted small" style={{ lineHeight: 1.5 }}>
              Keep your Bitcoin. Lock it as collateral with Mezo Borrow and get MUSD, then send it to your Qeep address.
            </span>
          </span>
        </a>

        <a href={config.mezoAppUrl} target="_blank" rel="noreferrer" className="option-card">
          <span className="option-icon" style={{ color: "var(--mint)" }}>
            <SwapIcon />
          </span>
          <span className="stack" style={{ gap: 4 }}>
            <strong>Swap BTC to MUSD</strong>
            <span className="muted small">Trade some BTC for MUSD in the Mezo app.</span>
          </span>
        </a>

        <Link href="/receive" className="option-card">
          <span className="option-icon" style={{ color: "var(--mint)" }}>
            <QrIcon />
          </span>
          <span className="stack" style={{ gap: 4 }}>
            <strong>Receive from someone</strong>
            <span className="muted small">Share your address or QR code.</span>
          </span>
        </Link>
      </div>

      <div className="spacer" />
      {config.isTestnet && (
        <div className="notice notice-warn">
          <span>
            <strong>Testnet.</strong> Need test BTC first? Get it free from the{" "}
            <a href={config.faucetUrl} target="_blank" rel="noreferrer">
              Mezo faucet
            </a>
            .
          </span>
        </div>
      )}
    </div>
  );
}

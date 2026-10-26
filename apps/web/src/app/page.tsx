import type { Metadata } from "next";
import Link from "next/link";
import { Logo, MARK } from "@/components/Brand";
import { LockIcon, ShieldIcon, SwapIcon } from "@/components/Icons";
import { LandingCta } from "@/components/landing/LandingCta";
import { HomePreview, VaultPreview } from "@/components/landing/Phones";
import { config } from "@/lib/config";
import s from "./landing.module.css";

export const metadata: Metadata = {
  title: "Qeep — your Bitcoin dollars, kept safe for decades",
  description:
    "Qeep is a MUSD wallet on Mezo. Spend daily with a normal key; anything bigger needs a post-quantum Vault Key.",
};

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;

export default function Landing() {
  return (
    <div className={s.page}>
      <div className={s.grid} aria-hidden="true" />

      <header className={s.nav}>
        <Link href="/" className={s.navLogo} aria-label="Qeep home">
          <Logo size={32} />
        </Link>
        <div className={s.navRight}>
          <span className={s.navPill}>
            <span className={s.dot} aria-hidden="true" />
            Live on {config.isTestnet ? "Mezo testnet" : "Mezo"}
          </span>
          <LandingCta variant="nav" />
        </div>
      </header>

      <main className={s.hero}>
        <div className={s.copy}>
          <span className={s.pill} style={{ alignSelf: "flex-start" }}>
            Built on Mezo · Post-quantum ready
          </span>

          <h1 className={s.title}>
            Your Bitcoin dollars, kept safe <span className={s.accent}>for decades.</span>
          </h1>

          <p className={s.sub}>
            Qeep is a MUSD wallet with two keys. A normal key for everyday spending, and a Vault Key that quantum
            computers can&apos;t forge for everything else.
          </p>

          <div className={s.ctas}>
            <LandingCta />
            {githubUrl && (
              <a href={githubUrl} className={s.secondary} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            )}
          </div>

          <ul className={s.points}>
            <li className={s.point}>
              <span className={s.pointIcon}>
                <ShieldIcon size={18} />
              </span>
              <span>
                <strong>Post-quantum Vault Key.</strong> Large sends need a hash-based one-time signature, checked
                on-chain.
              </span>
            </li>
            <li className={s.point}>
              <span className={s.pointIcon}>
                <LockIcon />
              </span>
              <span>
                <strong>Daily limit.</strong> If your phone or daily key is ever compromised, only one day&apos;s limit
                is exposed.
              </span>
            </li>
            <li className={s.point}>
              <span className={s.pointIcon}>
                <SwapIcon />
              </span>
              <span>
                <strong>Gasless MUSD.</strong> Qeep pays the BTC fees on Mezo. No setup, nothing to buy first.
              </span>
            </li>
          </ul>
        </div>

        <div className={s.stage} aria-label="Qeep app preview">
          <div className={s.glow} aria-hidden="true" />
          <svg
            className={s.drawn}
            viewBox="0 0 120 120"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: MARK }}
          />

          <div className={s.backSlot}>
            <VaultPreview />
          </div>
          <div className={s.frontSlot}>
            <HomePreview />
          </div>

          <div className={s.chip} aria-hidden="true">
            <ShieldIcon size={16} />
            One-time key · rotated
          </div>

          <div className={s.toast} aria-hidden="true">
            <span className={s.toastIcon}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  className={s.check}
                  d="M5.5 11.5l3.5 3.5 7.5-8"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              <span className={s.toastTitle} style={{ display: "block" }}>
                Vault Key approved
              </span>
              <span className={s.toastSub}>750.00 MUSD sent · verified on Mezo</span>
            </span>
          </div>
        </div>
      </main>

      <footer className={s.footer}>Testnet software, built for the Mezo Buildathon. Not audited yet.</footer>
    </div>
  );
}

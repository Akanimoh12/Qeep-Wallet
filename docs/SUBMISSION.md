# Mezo Buildathon submission kit

Wave 2 build period: November 2–15, 2026. Submit on AKINDO before the deadline. Replace every `[…]` before
submitting.

## Checklist

- [ ] Logo uploaded: `brand/qeep-app-icon-1024.png` (square). Cover image: `brand/qeep-cover-1920x1080.png`
- [ ] Live testnet link (Vercel URL) works on phone and desktop
- [ ] Public GitHub repository, README addresses filled in
- [ ] Deck (outline below)
- [ ] 2-minute pitch video (script below)
- [ ] AKINDO form (answers below)
- [ ] Relayer funded with test BTC before judging starts (November 16)

## AKINDO form answers

**Project name**
Qeep

**Project category (3–5 words)**
Post-quantum MUSD wallet

**TL;DR**
Qeep is a MUSD wallet on Mezo where daily spending uses a normal key and everything above the limit needs a
post-quantum Vault Key.

**How it works**
Qeep is a smart-contract wallet for people who hold MUSD as long-term savings. Almost every wallet signs with ECDSA,
which a large quantum computer can break, and MUSD is exactly the kind of asset people hold for years.

Each Qeep account has two keys. The Daily key is a normal key, encrypted with the user's password on their device; it
can send MUSD up to a daily limit. The Vault Key is a 24-word phrase kept offline. It signs with Winternitz one-time
signatures (WOTS), a hash-based post-quantum scheme, and the account verifies them on-chain on Mezo. Sends above the
limit, limit changes and wallet recovery all need the Vault Key. Each Vault Key signs once, then the account rotates to
the next key automatically.

If the Daily key is ever stolen or broken, the attacker gets at most one day's limit. Qeep is gasless: a relayer pays
BTC gas on Mezo but cannot move funds, because every action is checked against the user's signature on-chain.

MUSD is the asset Qeep holds, limits and protects. Qeep makes MUSD easier to start using (no gas, no seed-phrase
wallet setup, installable as a phone app) and safer to hold for years. Qeep's `vaultExecute` can call any contract,
so the same Vault Key can approve Mezo Borrow, swaps and pools, and the Qeep SDK lets other Mezo apps add a
post-quantum approval step.

**Target group**
Long-term MUSD holders and Bitcoin holders who borrow MUSD against BTC and want their savings protected for years.
Beginner to intermediate crypto users, mobile first (installable web app), desktop supported. Track 2: lowers the
friction of holding and using MUSD.

**Tech stack**
Solidity 0.8.28, Foundry, Next.js 16, React 19, TypeScript, viem, @scure/bip39, Web Crypto (PBKDF2 + AES-GCM),
Vercel, Mezo testnet.

**Track**
Track 2 (Access and Distribution). [Optional: also Track 1 once Mezo Borrow actions are added.]

**Chain deployed on**
Mezo (testnet, chain ID 31611)

**Project status**
Entirely new, built during the hackathon.

**Project readiness**
Testnet deployment.

**Future milestones**
1. December 2026: Mainnet beta. Audit of the account and WOTS verifier, WOTS+ upgrade, relayer rate limits.
2. Q1 2027: Mezo-native actions in Qeep (borrow MUSD against BTC, earn), all approved by the Vault Key; Telegram bot
   for daily sends.
3. Q2 2027: Publish `@qeep/sdk` so any Mezo app can add a post-quantum approval step; browser extension.

**Team info**
[Name – role – X/LinkedIn]

## 2-minute video script

| Time | Screen | Say |
| --- | --- | --- |
| 0:00–0:15 | Title slide | "Qeep is a MUSD wallet built to stay safe after quantum computers arrive." |
| 0:15–0:35 | Problem slide | "Almost every wallet signs with ECDSA. Quantum computers break ECDSA. MUSD is money people hold for years, so it's exactly what a future attacker goes after." |
| 0:35–0:55 | App: create wallet | "Creating a Qeep wallet takes a password and a 24-word Vault Key. No gas needed: Qeep pays it." |
| 0:55–1:15 | App: small send | "Daily sends under my limit use a normal key. Fast and free." |
| 1:15–1:40 | App: large send, Vault Key, explorer | "Anything bigger needs my Vault Key. It signs with a hash-based post-quantum signature, verified on-chain on Mezo, and then rotates to a fresh key." |
| 1:40–1:55 | Architecture slide | "If the daily key is ever broken, the attacker gets one day's limit. The rest of my MUSD is safe." |
| 1:55–2:00 | Closing slide | "Qeep. Your Bitcoin dollars, kept safe for decades." |

## Deck outline (8 slides)

1. **Qeep**: Your Bitcoin dollars, kept safe for decades. Live link, logo.
2. **The problem**: ECDSA everywhere; quantum timelines shrinking; wallets named as the exposed layer; MUSD is held
   long term.
3. **What Qeep is**: a MUSD wallet with a Daily key and a post-quantum Vault Key. One-sentence rule: under the limit,
   Daily key; above it, Vault Key.
4. **Demo**: four screenshots (create, home, send, Vault Key approval).
5. **How it works**: the diagram from the README; WOTS verified on-chain, one-time keys, gasless relayer.
6. **Why it matters for Mezo**: MUSD utility, lower friction, long-term holders, composable `vaultExecute`, SDK.
7. **Honest limits and roadmap**: what Qeep protects and what it doesn't; three milestones.
8. **Team and links**: GitHub, live app, contact.

# Qeep business model

**Who pays for gas?** Qeep does. Users never need BTC for fees. Qeep earns a small, visible fee only when
users act on Mezo through it: borrowing MUSD or depositing to the Stability Pool. Holding, receiving and
everyday sends stay free.

## What gas actually costs

Gas measured on Mezo testnet for each Qeep action (November 2026), priced at Mezo mainnet's gas price
(1.46 gwei) and BTC at $74,000:

| Action | Gas used | Cost to Qeep |
| --- | ---: | ---: |
| Create a wallet (one time) | 1,094,699 | $0.12 |
| Daily send (Daily key) | 135,447 | $0.015 |
| Large send (Vault Key, post-quantum) | 228,878 | $0.025 |
| Stability Pool deposit (Vault Key) | 339,150 | $0.037 |
| Open a Mezo loan (Vault Key) | 777,166 | $0.084 |

A heavy user (30 daily sends, 4 Vault sends and 2 Mezo actions a month) costs Qeep about **$0.67 a month**.
A typical saver costs a few cents.

## Revenue: a fee on Mezo actions

| Action | Qeep fee | Example |
| --- | --- | --- |
| Borrow MUSD (open a loan or borrow more) | 0.10% of the MUSD borrowed | 1,800 MUSD loan → 1.80 MUSD |
| Stability Pool deposit | 0.10% of the deposit | 1,000 MUSD → 1.00 MUSD |
| Receive, daily sends, Vault sends, repay, close, withdraw | Free | |

Repaying, closing a loan and withdrawing are free, so the fee never stands between a user and reducing risk.

**Unit economics.** One minimum Mezo loan (1,800 MUSD) pays 1.80 MUSD, which covers a heavy user's gas for
about 2.7 months, or a typical saver's for years. Every user who borrows or earns once on Mezo through Qeep
pays for themselves.

## Why the fee is fair and safe

- **Shown before signing.** The Vault Key approval screen lists the fee next to the action. The user signs
  both with one post-quantum signature.
- **All or nothing.** The fee and the Mezo action run in one batched Vault Key action. If the borrow or
  deposit fails, the fee is not taken.
- **The relayer still can't move funds.** The fee is a transfer the user signed, checked on-chain like any
  other Vault action.

## Status

| | Testnet today | Mainnet beta |
| --- | --- | --- |
| Gas | Fully sponsored by Qeep's relayer | Sponsored, funded by the fee |
| Fee | Off | On, collected through `vaultExecuteBatch` (QeepAccount v2) so the fee and action are one signature |
| Abuse limits | None | Per-account and per-IP relayer limits, a daily BTC spending cap on the relayer |

The batched Vault action is the one contract change the fee needs. It also lets Qeep combine steps that
need two signatures today, such as the one-time MUSD approval before a first Stability Pool deposit.

## Other revenue, later

- **Qeep SDK for Mezo apps.** Other Mezo apps add a post-quantum approval step with `@qeep/sdk`. A hosted
  relayer for them is a paid service.
- **Partnerships.** Mezo protocol incentives for bringing borrowers and Stability Pool depositors.

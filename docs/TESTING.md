# Testing Qeep

Qeep has three automated test layers and one manual checklist.

| Layer | Command | What it proves |
| --- | --- | --- |
| SDK unit tests | `npm test` | WOTS sign/verify, checksum, phrase handling, wrong-phrase refusal |
| Solidity tests | `cd contracts && forge test -vv` | Account rules: limits, nonces, replay, key rotation, failed calls, owner and limit changes, factory registry |
| End-to-end | `npm run test:e2e` | The real contracts (solc 0.8.28, EVM london) and the real SDK agree byte for byte, on an in-memory EVM. No Foundry needed |
| Testnet smoke | `QEEP_URL=https://qeep-wallet.vercel.app FACTORY=0x… npm --prefix e2e run testnet` | A running app's `/api/relay` and the deployed contracts on Mezo testnet: create, daily send, limit, Vault Key send, replay, restore. Set `MUSD_FUNDER_KEY` to a testnet key holding MUSD for real transfers |
| Manual | below | The live app on Mezo testnet |

`npm run test:e2e` may print a warning about `µWS` from Ganache. It is harmless.

## What the end-to-end test covers

1. Contracts compile with Mezo's EVM settings; the Foundry test and deploy script also compile
2. Factory deploys an account at the predicted address; the registry finds it from the phrase
3. Daily key sends 200 MUSD through a relayer (SDK digest equals contract digest)
4. Daily key is blocked above the limit
5. Vault Key, signed in TypeScript, sends 1,500 MUSD and is verified on-chain (gas is printed)
6. Replaying a used one-time key is rejected
7. A failing vault action still retires its key and moves nothing
8. A different phrase is refused before signing
9. Vault Key changes the daily limit
10. Restore: a new device key takes over and the old Daily key stops working

## Manual test on Mezo testnet

Do this locally (`npm run dev`) and again on the Vercel URL. Use two browsers (or one normal and one private window)
so you can test restore.

**Before you start:** the relayer has test BTC, and you have some test MUSD in a normal wallet (borrow or swap at
https://testnet.mezo.org).

| # | Step | Expected |
| --- | --- | --- |
| 1 | Open the app, tap **Create wallet**, set a password and a limit of `50` | Moves to the 24-word backup |
| 2 | Reveal and write down the 24 words, tick the box, **Create my wallet** | Spinner, then Home. Account visible on the explorer |
| 3 | **Receive**, copy the address, send it 100 MUSD from your normal wallet | Home shows 100 MUSD after refresh; Spendable today 50, Vault 50 |
| 4 | **Send** 10 MUSD to any address | Asks for the password once, then "Sent". Spendable today drops to 40 |
| 5 | **Send** 60 MUSD, then enter the 24 words and **Sign and send** | "Vault Key approval needed" first, then "Sent". Explorer shows a `vaultExecute` call |
| 6 | **Send** above the limit again, but swap two of the 24 words | Refused before anything is signed ("isn't a valid 24-word Vault Key" or "does not belong to this Qeep account") |
| 7 | **Security → New daily limit** `100`, approve with the Vault Key | "Limit updated". Security shows 100 MUSD and Vault Keys used: 2 |
| 8 | Second browser: **Restore with Vault Key**, enter the words and a new password | Home opens with the same balance |
| 9 | First browser: reload, then try a small send and unlock | Unlock fails: "This Daily key no longer controls the account" |
| 10 | Phone: open the Vercel URL, **Add to Home Screen** | Qeep installs with its icon and opens full screen |

Record a short screen capture of steps 1–5 for the pitch video.

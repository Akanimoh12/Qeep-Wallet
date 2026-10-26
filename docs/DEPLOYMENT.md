# Deploying Qeep to Mezo testnet and Vercel

Total cost: $0. Time: about 30–45 minutes the first time.

You will:

1. Create two testnet-only keys (deployer and relayer) and fund them with test BTC
2. Deploy `QeepAccountFactory` to Mezo testnet with Foundry
3. Run the app locally against it
4. Push to GitHub and deploy on Vercel
5. Put the addresses in the README

> Use fresh keys made only for testnet. Never put a key that holds real funds in `.env` or in Vercel.

---

## 0. Prerequisites

| Tool | Install | Check |
| --- | --- | --- |
| Node.js 22 (20+ works) | https://nodejs.org | `node -v` |
| Git | https://git-scm.com | `git --version` |
| Foundry | `curl -L https://foundry.paradigm.xyz \| bash` then `foundryup` | `forge --version` |
| GitHub account | https://github.com | |
| Vercel account (free) | https://vercel.com | |

On Windows, run the Foundry steps in WSL or Git Bash.

From the repo root:

```bash
npm install
npm test            # SDK tests should pass
npm run test:e2e    # contracts + SDK end-to-end, should print "All Qeep end-to-end checks passed."
```

## 1. Make the testnet keys

```bash
cast wallet new    # run twice: one DEPLOYER, one RELAYER
```

Save both addresses and private keys somewhere safe.

## 2. Fund them with test BTC

Open the Mezo faucet: https://faucet.test.mezo.org/ (it has a CAPTCHA, so do this by hand).

- Request test BTC for the **deployer** address.
- Request test BTC for the **relayer** address. The relayer pays gas for every user, so give it the most.

Check balances:

```bash
cast balance <DEPLOYER_ADDRESS> --rpc-url https://rpc.test.mezo.org --ether
cast balance <RELAYER_ADDRESS>  --rpc-url https://rpc.test.mezo.org --ether
```

## 3. Confirm the MUSD address

Qeep's default testnet MUSD address is `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`. Confirm it before deploying:

```bash
cast call 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 "symbol()(string)"   --rpc-url https://rpc.test.mezo.org
cast call 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 "decimals()(uint8)"   --rpc-url https://rpc.test.mezo.org
```

Expected: `"MUSD"` and `18`. If not, find the current address in the Mezo docs (https://mezo.org/docs) or ask in the
Mezo Discord, and use it everywhere below.

## 4. Test and deploy the contracts

```bash
cd contracts
forge build
forge test -vv          # all tests should pass

cp .env.example .env
# edit .env: DEPLOYER_PRIVATE_KEY=0x...  MUSD_ADDRESS=0x1189...
source .env

forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --legacy
```

The output prints `QeepAccountFactory: 0x...`. Save it. Check it:

```bash
cast call <FACTORY_ADDRESS> "musd()(address)" --rpc-url https://rpc.test.mezo.org
```

It must print the MUSD address. The deployment record is saved in `contracts/broadcast/`.

If the deploy fails with a gas or fee error, run it again with `--with-gas-price 1000000000` added.

## 5. Run the app locally

```bash
cd ..   # repo root
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```
NEXT_PUBLIC_FACTORY_ADDRESS=<FACTORY_ADDRESS>
RELAYER_PRIVATE_KEY=<RELAYER_PRIVATE_KEY>
```

Keep the other values as they are. Then:

```bash
npm run dev     # open http://localhost:3000
```

Run the manual test in [TESTING.md](TESTING.md#manual-test-on-mezo-testnet) before deploying.

## 6. Push to GitHub

```bash
git init
git add .
git commit -m "Qeep: post-quantum MUSD wallet on Mezo"
git branch -M main
git remote add origin https://github.com/<YOU>/qeep.git
git push -u origin main
```

Check that no `.env` or `.env.local` file was pushed (`.gitignore` excludes them).

## 7. Deploy on Vercel

1. Vercel → **Add New → Project** → import the `qeep` repo.
2. **Root Directory:** `apps/web` (click Edit next to the root directory).
3. **Framework Preset:** Next.js (detected automatically). Leave the build and install commands as default. Vercel
   installs the npm workspace from the repo root, so `@qeep/sdk` is found.
4. **Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_CHAIN_ID` | `31611` |
   | `NEXT_PUBLIC_RPC_URL` | `https://rpc.test.mezo.org` |
   | `NEXT_PUBLIC_EXPLORER_URL` | `https://explorer.test.mezo.org` |
   | `NEXT_PUBLIC_MUSD_ADDRESS` | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
   | `NEXT_PUBLIC_FACTORY_ADDRESS` | your factory address |
   | `RELAYER_PRIVATE_KEY` | your relayer private key (mark it **Sensitive**) |

5. **Deploy.** You get a URL like `https://qeep-xyz.vercel.app`.

`NEXT_PUBLIC_*` values are built into the app, so redeploy after changing any of them.

## 8. Check the live app

1. Open the Vercel URL on your phone and on desktop.
2. Create a wallet. The account address should appear on `explorer.test.mezo.org`.
3. Send yourself test MUSD from the Mezo testnet app to your Qeep address (Receive screen).
4. Do one small send and one send above the limit (Vault Key).
5. On a phone, use **Add to Home Screen** to install Qeep as an app.

## 9. Update the README

Fill in the **Live deployment** table in `README.md` with the Vercel URL, factory address and relayer address, then
commit and push.

## Keeping the relayer funded

Each user action costs the relayer a little test BTC (a vault action uses about 250k gas). Check its balance before
demos and top it up from the faucet:

```bash
cast balance <RELAYER_ADDRESS> --rpc-url https://rpc.test.mezo.org --ether
```

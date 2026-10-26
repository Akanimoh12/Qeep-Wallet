# Qeep web app

The Qeep wallet: a Next.js 16 progressive web app plus the gas relayer (`/api/relay`).

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_FACTORY_ADDRESS and RELAYER_PRIVATE_KEY
npm run dev                  # from the repo root, or here
```

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Landing page (hero with animated phone previews) |
| `src/app/(wallet)/` | Wallet screens: start, create, restore, home, send, receive, get-musd, security, activity |
| `src/components/Brand.tsx` | The Qeep logo mark, used everywhere |
| `src/app/api/relay/route.ts` | Relayer endpoint |
| `src/components/` | UI pieces, including `VaultApproval` (the post-quantum approval screen) |
| `src/lib/wallet.tsx` | Wallet context: encrypted Daily key, unlock and lock |
| `src/lib/vault.ts` | Signs and sends Vault Key actions with the one-time-key safeguards |
| `src/lib/server/relayer.ts` | Relayer logic (server only) |
| `public/` | PWA manifest, icons, service worker |

Deploy on Vercel with **Root Directory = `apps/web`**. See [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

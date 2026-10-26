# Qeep architecture

Qeep is three pieces that share one set of rules:

1. **Contracts** (`contracts/`): `QeepAccount` holds MUSD and enforces the two-key rules. `QeepAccountFactory` deploys
   accounts and keeps a registry. `WOTS` verifies post-quantum signatures.
2. **SDK** (`packages/sdk/`): derives Vault Keys from 24 words, signs with WOTS, builds the exact digests the contract
   checks, and exports the ABIs.
3. **Web app** (`apps/web/`): the wallet people use, plus `/api/relay`, the relayer that pays gas.

The SDK and the contracts must agree byte for byte. `npm run test:e2e` proves they do by compiling the real contracts
and driving them with the real SDK.

---

## Keys and where they live

| Secret | Where it lives | Leaves the device? |
| --- | --- | --- |
| Daily key (secp256k1 private key) | Browser `localStorage`, encrypted with the user's password (PBKDF2-SHA256, 310k iterations → AES-GCM-256) | Never |
| Daily key, unlocked | React state in memory until the tab closes or the user locks | Never |
| Vault Key phrase (24 words) | Written down by the user, offline. Typed in only to sign, then cleared from state | Never |
| Vault seed | Derived in memory while signing | Never |
| Relayer key | Vercel server environment variable | Server only |

What is on-chain: the Daily key **address**, a **hash** of the current one-time Vault Key public key, the vault key
counter, the daily limit and today's spending.

Qeep has no database. The chain is the source of truth. The browser keeps a small local activity list for convenience.

---

## Contracts

### QeepAccount

| Function | Who authorises it | Notes |
| --- | --- | --- |
| `spend(to, amount, deadline, sig)` | Daily key (EIP-191 signature) | MUSD only, within `remainingToday()`. Anyone may submit it, so the relayer pays gas |
| `vaultExecute(target, value, data, nextKeyHash, sig[67])` | Current one-time Vault Key (WOTS) | Any call from the account. Retires the key and commits to the next one before the call. Returns `success`; a failed call emits `VaultCallFailed` |
| `setOwner(newOwner)` | Only the account itself, so only via `vaultExecute` | Replaces the Daily key (restore, lost phone) |
| `setDailyLimit(limit)` | Only via `vaultExecute` | |

Digests (must match `packages/sdk/src/digests.ts`):

```
spend: keccak256(abi.encode(SPEND_TYPEHASH, chainId, account, spendNonce, to, amount, deadline))
       signed as personal_sign (EIP-191) by the Daily key

vault: keccak256(abi.encode(VAULT_TYPEHASH, chainId, account, vaultNonce, target, value, keccak256(data), nextKeyHash))
       signed with WOTS key #vaultNonce
```

Both bind the chain ID and the account address, so a signature can't be replayed on another account or chain. Both
carry a nonce, so a signature can't be replayed on the same account.

The daily limit uses UTC days (`block.timestamp / 1 days`). Spending resets at 00:00 UTC.

### QeepAccountFactory

- `createAccount(owner, firstVaultKeyHash, dailyLimit)` deploys with CREATE2, salt = `firstVaultKeyHash`.
- `accountOf[firstVaultKeyHash]` lets the 24 words find the account again on a new device.
- `isQeepAccount[account]` lets the relayer refuse anything that is not a Qeep account.
- `predictAddress(...)` returns the address before deployment.

### WOTS verifier

Winternitz one-time signatures over keccak256:

| Parameter | Value |
| --- | --- |
| Hash | keccak256, 32-byte output |
| Winternitz parameter | w = 16 (4 bits per digit) |
| Chains | 64 message digits + 3 checksum digits = 67 |
| Chain step | `F(x, chain, step) = keccak256(x ‖ uint16 chain ‖ uint8 step)` |
| Public key commitment | `keccak256(pk[0] ‖ … ‖ pk[66])` |
| Signature size | 67 × 32 bytes = 2,144 bytes |
| Verification cost | ≈ 251,000 gas for a full `vaultExecute` MUSD transfer (measured in `e2e/`) |

Key derivation (SDK only, never on-chain):

```
bip39Seed = BIP-39 seed of the 24 words with passphrase "qeep-vault-v1"
vaultSeed = keccak256(bip39Seed)
sk[k][i]  = keccak256(vaultSeed ‖ uint32 k ‖ uint16 i)      k = key index, i = chain
pk[k][i]  = F applied 15 times to sk[k][i]
```

The domain-separated passphrase means the same 24 words used in an ordinary Ethereum wallet would give unrelated
keys.

Why this is post-quantum: WOTS security rests only on the preimage resistance of the hash. Grover's algorithm gives a
quantum attacker at most a square-root speedup, leaving roughly 128-bit security for a 256-bit hash. Shor's algorithm,
which breaks ECDSA outright, does not apply.

---

## Flows

### Create

```
browser: password → generate Daily key, generate 24 words
browser: show words → user confirms backup
browser: firstVaultKeyHash = wotsKeyHash(seed, 0)
browser → /api/relay {create, owner, firstVaultKeyHash, dailyLimit}
relayer: simulate → factory.createAccount(...) → returns tx hash + account address
browser: wait for receipt, encrypt Daily key with password, save record, go to Home
```

### Daily send (under the limit)

```
browser: read spendNonce → spendDigest → Daily key personal_sign
browser → /api/relay {spend, account, to, amount, deadline, signature}
relayer: check factory.isQeepAccount → simulate → account.spend(...)
```

### Vault send (over the limit), limit change, restore

```
browser: user types 24 words → vaultSeed (words cleared from state)
browser: read vaultNonce n and vaultKeyHash from the chain
browser: check wotsKeyHash(seed, n) == vaultKeyHash   ← refuses a wrong phrase before signing
browser: nextKeyHash = wotsKeyHash(seed, n + 1)
browser: dry-run the call as the account; stop if it would fail
browser: digest = vaultDigest(...) → sig = wotsSign(seed, n, digest) → save as pending
browser → /api/relay {vault, account, target, value, data, nextKeyHash, signature[67]}
relayer: check isQeepAccount → simulate → account.vaultExecute(...)
contract: verify WOTS → vaultKeyHash = nextKeyHash, vaultNonce = n + 1 → execute call
          (call fails → VaultCallFailed, key still retired, nothing moved)
```

Restore uses the same flow with `target = account`, `data = setOwner(newDailyKey)`, after finding the account with
`factory.accountOf(wotsKeyHash(seed, 0))`.

### Why one-time keys are never reused

Signing two different messages with one WOTS key can let an attacker forge a third. Qeep stops reuse at four points:

1. **Key index from the chain.** The app always signs with the key for the on-chain `vaultNonce`, never a locally
   stored number.
2. **Dry-run before signing.** The app simulates the action as the account (`eth_call` from the account to the
   target). An action that would fail is never signed.
3. **Pending action guard.** A signed action is saved in the browser until it lands. If it did not land, the app sends
   the same signed action again. It never signs a different action with that key
   (`apps/web/src/lib/vault.ts`).
4. **Keys retire even on failure.** Once a valid signature reaches the contract, the key is retired, even if the call
   it authorises fails. The contract emits `VaultCallFailed` and returns `success = false` instead of reverting, so a
   signature that became public never belongs to a key that is still active.

---

## Web app

The landing page (`src/app/page.tsx`) is full width. Every wallet screen lives in the `(wallet)` route group, which
renders a phone-width column and eases each screen in with an iOS-style spring (`(wallet)/template.tsx`). All motion
respects the system "reduce motion" setting.

| Route | Screen |
| --- | --- |
| `/` | Landing page: hero with animated phone previews and a link into the wallet |
| `/start` | Welcome: create or restore (goes straight to Home if this device has a wallet) |
| `/create` | Password and daily limit, then 24-word backup, then account creation |
| `/restore` | 24 words + new password → finds account, sets a new Daily key |
| `/home` | Balance, spendable today, vault amount, actions, recent activity |
| `/send` | Daily key send, or Vault Key approval when over the limit |
| `/receive` | Address and QR code |
| `/get-musd` | Borrow or swap on Mezo, faucet link on testnet |
| `/security` | Account details, change limit (Vault Key), lock, remove from device |
| `/activity` | Actions made from this device, link to the explorer |
| `/api/relay` | Server route: validates input, simulates, submits with the relayer key |

Main code paths:

- `src/lib/wallet.tsx`: wallet context (encrypted record, unlocked signer)
- `src/lib/storage.ts`: encryption and local storage
- `src/lib/vault.ts`: `executeVaultAction`, the one place Vault Key actions are signed and sent
- `src/lib/server/relayer.ts`: the relayer
- `src/components/VaultApproval.tsx`: the Vault Key approval screen

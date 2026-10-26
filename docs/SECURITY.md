# Qeep security model

Qeep is unaudited testnet software. This page says exactly what Qeep protects, what it does not, and why.

## What Qeep protects

| Threat | Result |
| --- | --- |
| A quantum computer breaks the Daily key (ECDSA) | Attacker can send at most the remaining daily limit. Everything above it needs the Vault Key |
| Phone stolen while locked | Daily key is encrypted (PBKDF2-SHA256, 310k iterations, AES-GCM). Attacker needs the password |
| Phone stolen while unlocked, or malware on the device | Same as above: at most one day's limit. The Vault Key phrase is not stored on the device |
| Malicious or compromised relayer | Cannot move funds, change the limit or the owner. Every action is checked on-chain against a user signature. It can refuse to relay (denial of service) |
| Replay of an old signature | Rejected. Spend signatures use `spendNonce`; vault signatures use one-time keys that are retired after use. Both bind the chain ID and the account address |
| Signature for a different action | Rejected. The digest binds target, value, a hash of the calldata and the next key |
| Lost phone | Restore with the 24 words: a Vault Key action makes a new Daily key the owner |

## Why the Vault Key is post-quantum

The Vault Key signs with Winternitz one-time signatures (WOTS) over keccak256. Breaking WOTS means finding hash
preimages. The best known quantum attack on that is Grover's algorithm, a square-root speedup, which leaves about
128-bit security for a 256-bit hash. Shor's algorithm, which breaks ECDSA and other elliptic-curve schemes, does not
apply to hash functions.

Parameters: w = 16, 67 chains, 32-byte values. See [ARCHITECTURE.md](ARCHITECTURE.md#wots-verifier).

## One-time key safety

A WOTS key must sign only one message. Qeep enforces this in four places (key index from the chain, dry-run before
signing, a pending-action guard in the browser, and keys that retire even when the call fails). Details:
[ARCHITECTURE.md](ARCHITECTURE.md#why-one-time-keys-are-never-reused).

Remaining edge case: if a user signs a Vault action on device A, it never lands, and they then restore on device B and
sign a different action, two signatures for one key could exist. The relayer would have seen the first. To be safe,
finish or retry pending actions on the device where they were signed.

## What Qeep does not protect

- **The chain itself.** Mezo transactions are still signed with ECDSA. The relayer's own key is ECDSA. Qeep protects
  the user's funds, not Mezo consensus.
- **The daily allowance.** Up to the daily limit is protected only by the ECDSA Daily key.
- **A stolen Vault Key phrase.** Whoever has the 24 words controls the account. Keep them offline.
- **Weak passwords.** The Daily key's encryption is only as strong as the password.
- **Front-end supply chain.** A malicious build of the web app could steal the phrase when it is typed. Self-host or
  verify the build for large amounts.

## Known limitations (testnet version)

| Limitation | Plan |
| --- | --- |
| Plain WOTS, not WOTS+ (no per-key bitmasks). Domain separation by chain and step index only | Move to WOTS+ or SLH-DSA (NIST FIPS 205) before mainnet |
| Not audited | Audit before mainnet |
| Relayer has no rate limiting | Add per-IP and per-account limits, and a BTC spending cap |
| Anyone who sees a `createAccount` transaction could front-run it with the same first Vault Key hash and a different owner, blocking that wallet's creation (griefing only, no theft) | Bind the owner into the registry key or require a WOTS signature at creation |
| A relayer could submit a vault action with too little gas so the inner call runs out of gas. The key is spent, nothing moves | Sign a minimum call gas into the digest |
| Activity list only shows actions from this device | Index `Transfer` events for a full history |

## Reporting a problem

Open a GitHub issue marked `security`, or contact the team listed in the README. Please do not post exploit details
publicly before a fix.

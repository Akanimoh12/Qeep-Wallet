# @qeep/sdk

`@qeep/sdk` is the TypeScript library behind Qeep. It lets any app create post-quantum Vault Keys, sign actions for a
Qeep account and build the exact digests the contracts check.

It is used by the Qeep web app and tested against the real contracts in `e2e/`.

## What's inside

| Module | Exports |
| --- | --- |
| `vault` | `createVaultPhrase`, `isValidVaultPhrase`, `vaultSeedFromPhrase`, `firstVaultKeyHash` |
| `wots` | `wotsKeyHash`, `wotsSign`, `wotsVerify`, `wotsRecoverKeyHash`, `wotsDigits` |
| `actions` | `signVaultAction`, `musdTransferCall`, `setOwnerCall`, `setDailyLimitCall`, `WrongVaultKeyError` |
| `digests` | `spendDigest`, `vaultDigest`, `SPEND_TYPEHASH`, `VAULT_TYPEHASH` |
| `abi` | `qeepAccountAbi`, `qeepFactoryAbi`, `erc20Abi` |
| `chains` | `mezoTestnet`, `mezoMainnet`, `MUSD_TESTNET`, `MUSD_MAINNET` |

## Example: send MUSD above the daily limit

```ts
import { createPublicClient, http, parseUnits } from "viem";
import { mezoTestnet, MUSD_TESTNET, musdTransferCall, qeepAccountAbi, signVaultAction, vaultSeedFromPhrase } from "@qeep/sdk";

const client = createPublicClient({ chain: mezoTestnet, transport: http() });
const seed = vaultSeedFromPhrase(words); // 24 words typed by the user

// Always read the current key index and key hash from the chain right before signing.
const [nonce, currentKeyHash] = await Promise.all([
  client.readContract({ address: account, abi: qeepAccountAbi, functionName: "vaultNonce" }),
  client.readContract({ address: account, abi: qeepAccountAbi, functionName: "vaultKeyHash" }),
]);

const signed = signVaultAction({
  seed,
  chainId: mezoTestnet.id,
  account,
  nonce,
  currentKeyHash,
  target: MUSD_TESTNET,
  data: musdTransferCall(recipient, parseUnits("750", 18)),
});

// Submit account.vaultExecute(signed.target, signed.value, signed.data, signed.nextKeyHash, signed.signature)
// from any address (a relayer can pay the gas).
```

## Rules for integrators

- A WOTS key signs **one** message. Take the key index from the on-chain `vaultNonce` every time.
- Dry-run the call as the account (`eth_call` from the account address) before signing, so you never sign an action
  that will fail.
- If a signed action did not land, resend the same signed action. Do not sign a different action for the same nonce.
- `signVaultAction` throws `WrongVaultKeyError` before signing if the phrase does not belong to the account.

## Tests

```bash
npm test            # from the repo root: SDK unit tests
npm run test:e2e    # SDK against the real compiled contracts
```

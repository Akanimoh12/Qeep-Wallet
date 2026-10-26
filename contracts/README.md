# Qeep contracts

| Contract | Purpose |
| --- | --- |
| `src/QeepAccount.sol` | MUSD smart account. Daily key (ECDSA) sends up to a daily limit; the post-quantum Vault Key (WOTS) approves everything else |
| `src/QeepAccountFactory.sol` | Deploys accounts with CREATE2 and keeps a registry (`accountOf`, `isQeepAccount`) |
| `src/WOTS.sol` | Winternitz one-time signature verifier over keccak256 (w = 16, 67 chains) |
| `test/QeepAccount.t.sol` | Foundry tests |
| `script/Deploy.s.sol` | Deploys the factory |

Mezo's EVM targets the London hard fork, so `foundry.toml` sets `evm_version = "london"` with Solidity 0.8.28.
`forge-std` is vendored in `lib/`, so no `forge install` is needed.

```bash
forge build
forge test -vv
cp .env.example .env && source .env
forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --legacy
```

Full steps: [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md). Design: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

import { encodeAbiParameters, keccak256, toBytes, type Address, type Hex } from "viem";

/** Must match QeepAccount.SPEND_TYPEHASH. */
export const SPEND_TYPEHASH = keccak256(
  toBytes("QeepSpend(uint256 chainId,address account,uint256 nonce,address to,uint256 amount,uint256 deadline)"),
);

/** Must match QeepAccount.VAULT_TYPEHASH. */
export const VAULT_TYPEHASH = keccak256(
  toBytes(
    "QeepVaultExecute(uint256 chainId,address account,uint256 nonce,address target,uint256 value,bytes32 dataHash,bytes32 nextKeyHash)",
  ),
);

export type SpendRequest = {
  chainId: number;
  account: Address;
  nonce: bigint;
  to: Address;
  amount: bigint;
  deadline: bigint;
};

/** Digest the Daily key signs (with EIP-191 personal_sign) to send MUSD within the limit. */
export function spendDigest(r: SpendRequest): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [SPEND_TYPEHASH, BigInt(r.chainId), r.account, r.nonce, r.to, r.amount, r.deadline],
    ),
  );
}

export type VaultRequest = {
  chainId: number;
  account: Address;
  nonce: bigint;
  target: Address;
  value: bigint;
  data: Hex;
  nextKeyHash: Hex;
};

/** Digest the one-time Vault Key signs to authorise any call from the account. */
export function vaultDigest(r: VaultRequest): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [VAULT_TYPEHASH, BigInt(r.chainId), r.account, r.nonce, r.target, r.value, keccak256(r.data), r.nextKeyHash],
    ),
  );
}

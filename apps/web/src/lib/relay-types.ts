import type { Address, Hex } from "viem";

export type CreateRelayRequest = {
  action: "create";
  owner: Address;
  firstVaultKeyHash: Hex;
  dailyLimit: string;
};

export type SpendRelayRequest = {
  action: "spend";
  account: Address;
  to: Address;
  amount: string;
  deadline: string;
  signature: Hex;
};

export type VaultRelayRequest = {
  action: "vault";
  account: Address;
  target: Address;
  value: string;
  data: Hex;
  nextKeyHash: Hex;
  signature: Hex[];
};

export type RelayRequest = CreateRelayRequest | SpendRelayRequest | VaultRelayRequest;

export type RelayResponse = { hash: Hex; account?: Address } | { error: string };

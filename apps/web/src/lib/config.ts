import { MUSD_TESTNET, mezoMainnet, mezoTestnet } from "@qeep/sdk";
import { defineChain, isAddress, zeroAddress, type Address } from "viem";

// NEXT_PUBLIC_* values are inlined at build time, so each one is read by its full name.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? mezoTestnet.id);
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? mezoTestnet.rpcUrls.default.http[0];
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL ?? mezoTestnet.blockExplorers.default.url;
const musd = process.env.NEXT_PUBLIC_MUSD_ADDRESS ?? MUSD_TESTNET;
const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? zeroAddress;

const base = chainId === mezoMainnet.id ? mezoMainnet : mezoTestnet;

export const chain = defineChain({
  ...base,
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: explorerUrl } },
});

export const config = {
  chainId,
  rpcUrl,
  explorerUrl,
  isTestnet: chainId === mezoTestnet.id,
  musd: musd as Address,
  factory: factory as Address,
  musdDecimals: 18,
  defaultDailyLimit: "500",
  mezoAppUrl: chainId === mezoTestnet.id ? "https://testnet.mezo.org" : "https://mezo.org",
  faucetUrl: "https://faucet.test.mezo.org/",
} as const;

export function isConfigured(): boolean {
  return isAddress(config.factory) && config.factory !== zeroAddress && isAddress(config.musd);
}

export function explorerTx(hash: string) {
  return `${config.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${config.explorerUrl}/address/${address}`;
}

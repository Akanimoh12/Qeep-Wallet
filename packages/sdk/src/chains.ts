import { defineChain } from "viem";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.test.mezo.org"], webSocket: ["wss://rpc-ws.test.mezo.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
  testnet: true,
});

export const mezoMainnet = defineChain({
  id: 31612,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mezo.drpc.org"], webSocket: ["wss://mezo.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" },
  },
});

/** MUSD on Mezo testnet. Verify on the explorer before relying on it. */
export const MUSD_TESTNET = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as const;
/** MUSD on Mezo mainnet. */
export const MUSD_MAINNET = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186" as const;

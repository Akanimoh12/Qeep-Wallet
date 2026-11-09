import { formatUnits, parseUnits } from "viem";
import { config } from "./config";

export function formatMusd(value: bigint, maxDecimals = 2): string {
  const n = Number(formatUnits(value, config.musdDecimals));
  return n.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, maxDecimals),
    maximumFractionDigits: maxDecimals,
  });
}

/** Parses user input like "750" or "12.5" into MUSD wei. Returns null if invalid. */
export function parseMusd(input: string): bigint | null {
  const clean = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,18})?$/.test(clean)) return null;
  try {
    const v = parseUnits(clean, config.musdDecimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

export function formatBtc(value: bigint, maxDecimals = 6): string {
  const n = Number(formatUnits(value, 18));
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

/** USD value of `btc` (18 decimals) at `price` (USD, 18 decimals). */
export function btcToUsd(btc: bigint, price: bigint): bigint {
  return (btc * price) / 10n ** 18n;
}

/** Ratio with 18 decimals (1e18 = 100%) as a percentage string. */
export function formatRatio(ratio: bigint): string {
  return `${(Number(ratio / 10n ** 14n) / 100).toFixed(0)}%`;
}

export type Health = { label: string; color: string; fill: number };

/** Loan health from the collateral ratio: Mezo liquidates below 110% and enters recovery mode below 150%. */
export function loanHealth(ratio: bigint): Health {
  const pct = Number(ratio / 10n ** 14n) / 100;
  const fill = Math.max(0, Math.min(1, (pct - 110) / (250 - 110)));
  if (pct < 125) return { label: "At risk", color: "var(--danger)", fill };
  if (pct < 160) return { label: "Fair", color: "var(--amber)", fill };
  return { label: "Healthy", color: "var(--mint)", fill };
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

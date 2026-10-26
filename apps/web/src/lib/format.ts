import { formatUnits, parseUnits } from "viem";
import { config } from "./config";

export function formatMusd(value: bigint, maxDecimals = 2): string {
  const n = Number(formatUnits(value, config.musdDecimals));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
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

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

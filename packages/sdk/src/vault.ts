import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { keccak256, type Hex } from "viem";
import { wotsKeyHash } from "./wots";

/** Creates a new 24-word Vault Key phrase (256 bits of entropy). */
export function createVaultPhrase(): string {
  return generateMnemonic(wordlist, 256);
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

export function isValidVaultPhrase(phrase: string): boolean {
  const normalized = normalizePhrase(phrase);
  return normalized.split(" ").length === 24 && validateMnemonic(normalized, wordlist);
}

/**
 * Turns the 24 words into the 32-byte Vault seed every one-time key is derived from.
 * The domain tag keeps this seed separate from any normal Ethereum wallet using the same words.
 */
export function vaultSeedFromPhrase(phrase: string): Hex {
  const normalized = normalizePhrase(phrase);
  if (!isValidVaultPhrase(normalized)) throw new Error("Invalid Vault Key phrase");
  const bip39Seed = mnemonicToSeedSync(normalized, "qeep-vault-v1");
  return keccak256(bip39Seed);
}

/** Hash of the very first Vault Key. The factory uses it to find a wallet when restoring. */
export function firstVaultKeyHash(seed: Hex): Hex {
  return wotsKeyHash(seed, 0);
}

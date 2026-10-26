import type { Address, Hex } from "viem";

/**
 * The Daily key is stored only in this browser, encrypted with the user's password
 * (PBKDF2-SHA256 → AES-GCM). The Vault Key phrase is never stored anywhere by Qeep.
 */

export type EncryptedBlob = { salt: string; iv: string; data: string };

export type WalletRecord = {
  version: 1;
  account: Address;
  owner: Address;
  encryptedKey: EncryptedBlob;
  createdAt: number;
};

export type HistoryItem = {
  hash: Hex;
  kind: "sent" | "vault-sent" | "limit" | "restore" | "created";
  amount?: string;
  to?: Address;
  at: number;
};

const WALLET_KEY = "qeep.wallet.v1";
const HISTORY_KEY = "qeep.history.v1";
const PBKDF2_ITERATIONS = 310_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(secret: string, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(password, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(secret)));
  return { salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

export async function decryptSecret(blob: EncryptedBlob, password: string): Promise<string> {
  const key = await deriveKey(password, fromB64(blob.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.data));
    return dec.decode(plain);
  } catch {
    throw new Error("Wrong password");
  }
}

export function loadWallet(): WalletRecord | null {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    return raw ? (JSON.parse(raw) as WalletRecord) : null;
  } catch {
    return null;
  }
}

export function saveWallet(record: WalletRecord) {
  localStorage.setItem(WALLET_KEY, JSON.stringify(record));
}

export function clearWallet() {
  localStorage.removeItem(WALLET_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(item: HistoryItem) {
  try {
    const items = [item, ...loadHistory()].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: history is a convenience, the chain is the source of truth.
  }
}

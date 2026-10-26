import { bytesToHex, hexToBytes, keccak256, type Hex } from "viem";

/**
 * Winternitz one-time signatures (WOTS) over keccak256.
 *
 * Must match contracts/src/WOTS.sol exactly:
 *   n = 32 bytes, w = 16, 64 message digits + 3 checksum digits = 67 chains.
 *   F(x, chain, step) = keccak256(x ‖ uint16 chain ‖ uint8 step)
 *   key hash          = keccak256(pk[0] ‖ … ‖ pk[66])
 *
 * Each key signs exactly ONE message. Signing two different messages with the same key
 * leaks enough to forge signatures, so callers must always derive the key for the
 * account's current on-chain vaultNonce and never cache or reuse a signature key.
 */

export const WOTS_LEN = 67;
export const WOTS_MSG_DIGITS = 64;
export const WOTS_W_MAX = 15;

export type WotsSignature = readonly Hex[]; // 67 × bytes32

const stepBuf = new Uint8Array(35);

function step(x: Uint8Array, chain: number, stepIndex: number): Uint8Array {
  stepBuf.set(x, 0);
  stepBuf[32] = (chain >> 8) & 0xff;
  stepBuf[33] = chain & 0xff;
  stepBuf[34] = stepIndex & 0xff;
  return keccak256(stepBuf, "bytes");
}

function chainHash(x: Uint8Array, chain: number, from: number, to: number): Uint8Array {
  let out = x;
  for (let j = from; j < to; j++) out = step(out, chain, j);
  return out;
}

/** Splits a 32-byte message into 64 base-16 digits plus a 3-digit checksum. */
export function wotsDigits(message: Hex): number[] {
  const bytes = hexToBytes(message);
  if (bytes.length !== 32) throw new Error("WOTS message must be 32 bytes");
  const d: number[] = [];
  let checksum = 0;
  for (const b of bytes) {
    d.push(b >> 4, b & 0x0f);
  }
  for (const v of d) checksum += WOTS_W_MAX - v;
  d.push((checksum >> 8) & 0xf, (checksum >> 4) & 0xf, checksum & 0xf);
  return d;
}

/** Secret chain start for one key: keccak256(seed ‖ uint32 keyIndex ‖ uint16 chain). */
function secret(seed: Uint8Array, keyIndex: number, chain: number): Uint8Array {
  const buf = new Uint8Array(38);
  buf.set(seed, 0);
  const view = new DataView(buf.buffer);
  view.setUint32(32, keyIndex, false);
  view.setUint16(36, chain, false);
  return keccak256(buf, "bytes");
}

function checkSeed(seed: Hex): Uint8Array {
  const bytes = hexToBytes(seed);
  if (bytes.length !== 32) throw new Error("Vault seed must be 32 bytes");
  return bytes;
}

function checkIndex(keyIndex: number) {
  if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex > 0xffffffff) {
    throw new Error("Vault key index must be a uint32");
  }
}

/** Hash of the public key at `keyIndex`. This is what the account stores on-chain. */
export function wotsKeyHash(seed: Hex, keyIndex: number): Hex {
  checkIndex(keyIndex);
  const s = checkSeed(seed);
  const pk = new Uint8Array(WOTS_LEN * 32);
  for (let i = 0; i < WOTS_LEN; i++) {
    pk.set(chainHash(secret(s, keyIndex, i), i, 0, WOTS_W_MAX), i * 32);
  }
  return keccak256(pk);
}

/** Signs a 32-byte digest with the one-time key at `keyIndex`. */
export function wotsSign(seed: Hex, keyIndex: number, message: Hex): Hex[] {
  checkIndex(keyIndex);
  const s = checkSeed(seed);
  const d = wotsDigits(message);
  const sig: Hex[] = [];
  for (let i = 0; i < WOTS_LEN; i++) {
    sig.push(bytesToHex(chainHash(secret(s, keyIndex, i), i, 0, d[i])));
  }
  return sig;
}

/** Recomputes the key hash a signature commits to. Mirrors WOTS.publicKeyHash on-chain. */
export function wotsRecoverKeyHash(message: Hex, signature: WotsSignature): Hex {
  if (signature.length !== WOTS_LEN) throw new Error(`WOTS signature must have ${WOTS_LEN} parts`);
  const d = wotsDigits(message);
  const pk = new Uint8Array(WOTS_LEN * 32);
  for (let i = 0; i < WOTS_LEN; i++) {
    pk.set(chainHash(hexToBytes(signature[i]), i, d[i], WOTS_W_MAX), i * 32);
  }
  return keccak256(pk);
}

export function wotsVerify(message: Hex, signature: WotsSignature, keyHash: Hex): boolean {
  return wotsRecoverKeyHash(message, signature).toLowerCase() === keyHash.toLowerCase();
}

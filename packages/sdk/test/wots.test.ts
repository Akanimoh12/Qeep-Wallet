import assert from "node:assert/strict";
import { test } from "node:test";
import { keccak256, toBytes } from "viem";
import {
  WrongVaultKeyError,
  createVaultPhrase,
  isValidVaultPhrase,
  signVaultAction,
  vaultSeedFromPhrase,
  wotsDigits,
  wotsKeyHash,
  wotsRecoverKeyHash,
  wotsSign,
  wotsVerify,
} from "../src/index";

const seed = keccak256(toBytes("qeep test vault seed"));
const message = keccak256(toBytes("send 750 MUSD"));

test("digits: 64 message digits plus 3 checksum digits", () => {
  const d = wotsDigits(message);
  assert.equal(d.length, 67);
  const sum = d.slice(0, 64).reduce((acc, v) => acc + (15 - v), 0);
  assert.equal((d[64] << 8) | (d[65] << 4) | d[66], sum);
});

test("sign then verify against the key hash", () => {
  const sig = wotsSign(seed, 0, message);
  assert.equal(sig.length, 67);
  assert.ok(wotsVerify(message, sig, wotsKeyHash(seed, 0)));
});

test("a signature does not verify for a different message or key", () => {
  const sig = wotsSign(seed, 0, message);
  const other = keccak256(toBytes("send 9999 MUSD"));
  assert.notEqual(wotsRecoverKeyHash(other, sig), wotsKeyHash(seed, 0));
  assert.equal(wotsVerify(message, sig, wotsKeyHash(seed, 1)), false);
});

test("each key index gives a different key", () => {
  assert.notEqual(wotsKeyHash(seed, 0), wotsKeyHash(seed, 1));
});

test("vault phrase: 24 words, deterministic seed", () => {
  const phrase = createVaultPhrase();
  assert.equal(phrase.split(" ").length, 24);
  assert.ok(isValidVaultPhrase(phrase));
  assert.equal(vaultSeedFromPhrase(phrase), vaultSeedFromPhrase(`  ${phrase.toUpperCase()}  `));
  assert.equal(isValidVaultPhrase("hello world"), false);
});

test("signVaultAction refuses a phrase that does not match the account", () => {
  const otherSeed = keccak256(toBytes("someone else"));
  assert.throws(
    () =>
      signVaultAction({
        seed: otherSeed,
        chainId: 31611,
        account: "0x0000000000000000000000000000000000000001",
        nonce: 0n,
        currentKeyHash: wotsKeyHash(seed, 0),
        target: "0x0000000000000000000000000000000000000002",
        data: "0x",
      }),
    WrongVaultKeyError,
  );
});

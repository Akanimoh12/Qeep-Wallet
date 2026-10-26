/**
 * Qeep testnet smoke test.
 * Drives a running Qeep app (its /api/relay) against the deployed contracts on Mezo testnet, signing in
 * TypeScript exactly like the browser does. Creates a fresh wallet each run.
 *
 *   QEEP_URL=http://localhost:3000 FACTORY=0x… npm --prefix e2e run testnet
 *
 * Optional: MUSD_FUNDER_KEY, a testnet key holding MUSD. When set, 100 MUSD is moved into the new account
 * so real daily and vault sends run. Without it, sends are checked up to the transfer itself.
 */
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  createVaultPhrase,
  erc20Abi,
  firstVaultKeyHash,
  mezoTestnet,
  MUSD_TESTNET,
  musdTransferCall,
  qeepAccountAbi,
  qeepFactoryAbi,
  setDailyLimitCall,
  setOwnerCall,
  signVaultAction,
  spendDigest,
  vaultSeedFromPhrase,
  WrongVaultKeyError,
} from "../packages/sdk/src/index";

const QEEP_URL = (process.env.QEEP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FACTORY = process.env.FACTORY as Address;
const MUSD = (process.env.MUSD ?? MUSD_TESTNET) as Address;
const RPC = process.env.RPC_URL ?? "https://rpc.test.mezo.org";
const CHAIN_ID = mezoTestnet.id;
if (!FACTORY) throw new Error("Set FACTORY to the deployed QeepAccountFactory address.");

const pub = createPublicClient({ chain: mezoTestnet, transport: http(RPC) });
const ok = (label: string) => console.log(`  ✓ ${label}`);
const tx = (hash: Hex) => `https://explorer.test.mezo.org/tx/${hash}`;

type RelayBody = Record<string, unknown>;

async function relayRaw(body: RelayBody): Promise<{ hash?: Hex; account?: Address; error?: string }> {
  const res = await fetch(`${QEEP_URL}/api/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function relay(body: RelayBody) {
  const out = await relayRaw(body);
  if (out.error || !out.hash) throw new Error(`relay ${body.action} failed: ${out.error}`);
  const receipt = await pub.waitForTransactionReceipt({ hash: out.hash, timeout: 120_000 });
  assert.equal(receipt.status, "success", `tx failed: ${tx(out.hash)}`);
  return { ...out, receipt };
}

async function relayExpectError(body: RelayBody, name: string) {
  const out = await relayRaw(body);
  assert.ok(out.error?.includes(name), `expected ${name}, got ${out.error ?? `success ${out.hash}`}`);
}

const read = <T>(functionName: string, account: Address): Promise<T> =>
  pub.readContract({ address: account, abi: qeepAccountAbi, functionName: functionName as never }) as Promise<T>;

async function spendBody(signer: PrivateKeyAccount, account: Address, to: Address, amount: bigint) {
  const nonce = await read<bigint>("spendNonce", account);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  const digest = spendDigest({ chainId: CHAIN_ID, account, nonce, to, amount, deadline });
  const signature = await signer.signMessage({ message: { raw: digest } });
  return { action: "spend", account, to, amount: amount.toString(), deadline: deadline.toString(), signature };
}

async function vaultBody(seed: Hex, account: Address, target: Address, data: Hex) {
  const [nonce, currentKeyHash] = await Promise.all([
    read<bigint>("vaultNonce", account),
    read<Hex>("vaultKeyHash", account),
  ]);
  await pub.call({ account, to: target, data }); // dry-run as the account, like the app
  const s = signVaultAction({ seed, chainId: CHAIN_ID, account, nonce, currentKeyHash, target, data });
  return {
    action: "vault",
    account,
    target: s.target,
    value: s.value.toString(),
    data: s.data,
    nextKeyHash: s.nextKeyHash,
    signature: s.signature,
  };
}

async function vault(seed: Hex, account: Address, target: Address, data: Hex) {
  const body = await vaultBody(seed, account, target, data);
  const r = await relay(body);
  const failed = parseEventLogs({ abi: qeepAccountAbi, eventName: "VaultCallFailed", logs: r.receipt.logs });
  assert.equal(failed.length, 0, "vault call failed on-chain");
  return { ...r, body };
}

async function main() {
  console.log(`Qeep testnet smoke test — app ${QEEP_URL}, factory ${FACTORY}`);

  const pre = await relayRaw({ action: "nope" });
  assert.equal(pre.error, "Unknown action", `relayer not configured: ${pre.error}`);
  ok("relayer is configured");

  // ---- create
  const phrase = createVaultPhrase();
  const seed = vaultSeedFromPhrase(phrase);
  const daily = privateKeyToAccount(generatePrivateKey());
  const limit = parseUnits("50", 18);
  const created = await relay({
    action: "create",
    owner: daily.address,
    firstVaultKeyHash: firstVaultKeyHash(seed),
    dailyLimit: limit.toString(),
  });
  const account = created.account!;
  const found = await pub.readContract({
    address: FACTORY,
    abi: qeepFactoryAbi,
    functionName: "accountOf",
    args: [firstVaultKeyHash(seed)],
  });
  assert.equal(found.toLowerCase(), account.toLowerCase());
  assert.equal((await read<Address>("owner", account)).toLowerCase(), daily.address.toLowerCase());
  assert.equal(await read<bigint>("dailyLimit", account), limit);
  ok(`account created ${account} (${tx(created.hash!)}); registry finds it from the phrase`);

  // ---- optional funding
  let funded = false;
  if (process.env.MUSD_FUNDER_KEY) {
    const funder = createWalletClient({
      chain: mezoTestnet,
      transport: http(RPC),
      account: privateKeyToAccount(process.env.MUSD_FUNDER_KEY as Hex),
    });
    const bal = await pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "balanceOf", args: [funder.account.address] });
    if (bal >= parseUnits("100", 18)) {
      // Set gas, nonce and fees so viem skips Mezo's eth_fillTransaction (it under-reports gas).
      const [fees, nonce] = await Promise.all([
        pub.estimateFeesPerGas(),
        pub.getTransactionCount({ address: funder.account.address, blockTag: "pending" }),
      ]);
      const h = await funder.writeContract({
        address: MUSD,
        abi: erc20Abi,
        functionName: "transfer",
        args: [account, parseUnits("100", 18)],
        gas: 150_000n,
        nonce,
        ...fees,
      });
      await pub.waitForTransactionReceipt({ hash: h });
      funded = true;
      ok("funded account with 100 MUSD");
    } else {
      console.log(`  · funder has only ${formatUnits(bal, 18)} MUSD, skipping real transfers`);
    }
  }

  const recipient = privateKeyToAccount(generatePrivateKey()).address;
  const musdBal = (a: Address) => pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "balanceOf", args: [a] });

  // ---- daily spend
  if (funded) {
    const r = await relay(await spendBody(daily, account, recipient, parseUnits("10", 18)));
    assert.equal(await musdBal(recipient), parseUnits("10", 18));
    assert.equal(await read<bigint>("remainingToday", account), parseUnits("40", 18));
    ok(`Daily key sent 10 MUSD (${tx(r.hash!)}); 40 left today`);
  } else {
    await relayExpectError(await spendBody(daily, account, recipient, parseUnits("10", 18)), "TransferFailed");
    ok("Daily key signature accepted on-chain (stops at TransferFailed: account holds no MUSD)");
  }
  await relayExpectError(await spendBody(daily, account, recipient, parseUnits("60", 18)), "OverDailyLimit");
  ok("Daily key blocked above the limit (OverDailyLimit)");

  // ---- vault: wrong phrase refused before signing
  const otherSeed = vaultSeedFromPhrase(createVaultPhrase());
  await assert.rejects(vaultBody(otherSeed, account, account, setDailyLimitCall(1n)), WrongVaultKeyError);
  ok("a different phrase is refused before signing");

  // ---- vault: change limit
  const newLimit = parseUnits("100", 18);
  const lim = await vault(seed, account, account, setDailyLimitCall(newLimit));
  assert.equal(await read<bigint>("dailyLimit", account), newLimit);
  assert.equal(await read<bigint>("vaultNonce", account), 1n);
  ok(`Vault Key (WOTS) changed the limit to 100 MUSD (${tx(lim.hash!)}, gas ${lim.receipt.gasUsed})`);

  // ---- replay
  await relayExpectError(lim.body, "BadVaultKey");
  ok("replaying the used one-time key is rejected (BadVaultKey)");

  // ---- vault: large send
  if (funded) {
    const before = await musdBal(recipient);
    const big = await vault(seed, account, MUSD, musdTransferCall(recipient, parseUnits("60", 18)));
    assert.equal((await musdBal(recipient)) - before, parseUnits("60", 18));
    ok(`Vault Key sent 60 MUSD (${tx(big.hash!)}, gas ${big.receipt.gasUsed})`);
  }

  // ---- restore on a "new device"
  const restoredAccount = await pub.readContract({
    address: FACTORY,
    abi: qeepFactoryAbi,
    functionName: "accountOf",
    args: [firstVaultKeyHash(seed)],
  });
  const newDaily = privateKeyToAccount(generatePrivateKey());
  const rest = await vault(seed, restoredAccount, restoredAccount, setOwnerCall(newDaily.address));
  assert.equal((await read<Address>("owner", account)).toLowerCase(), newDaily.address.toLowerCase());
  await relayExpectError(await spendBody(daily, account, recipient, 1n), "BadSignature");
  ok(`restore: new Daily key took over (${tx(rest.hash!)}); old Daily key rejected (BadSignature)`);

  console.log(`\nAll Qeep testnet checks passed${funded ? "" : " (MUSD transfers skipped: no funded MUSD_FUNDER_KEY)"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

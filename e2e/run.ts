/**
 * Qeep end-to-end check.
 * Compiles the real contracts (solc 0.8.28, EVM london, same as Mezo) and drives them with the
 * real SDK on an in-memory EVM. Proves the TypeScript signer and the Solidity verifier agree.
 *
 * Run from the repo root:  npm run test:e2e
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ganache from "ganache";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  parseEventLogs,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createVaultPhrase,
  erc20Abi,
  firstVaultKeyHash,
  musdTransferCall,
  qeepAccountAbi,
  qeepFactoryAbi,
  setDailyLimitCall,
  setOwnerCall,
  signVaultAction,
  spendDigest,
  vaultDigest,
  vaultSeedFromPhrase,
  WrongVaultKeyError,
} from "../packages/sdk/src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts");
const CHAIN_ID = 31611;

// ---------------------------------------------------------------- compile
function compile() {
  const files = [
    "src/WOTS.sol",
    "src/QeepAccount.sol",
    "src/QeepAccountFactory.sol",
    "src/interfaces/IERC20.sol",
    "test/mocks/MockMUSD.sol",
  ];
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(files.map((f) => [f, { content: readFileSync(join(root, f), "utf8") }])),
    settings: {
      evmVersion: "london",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n"));
  const get = (file: string, name: string) => ({
    abi: out.contracts[file][name].abi as Abi,
    bytecode: `0x${out.contracts[file][name].evm.bytecode.object}` as Hex,
  });
  return {
    factory: get("src/QeepAccountFactory.sol", "QeepAccountFactory"),
    musd: get("test/mocks/MockMUSD.sol", "MockMUSD"),
  };
}

// ---------------------------------------------------------------- chain
const deployerKey = generatePrivateKey();
const relayerKey = generatePrivateKey();
const provider = ganache.provider({
  chain: { chainId: CHAIN_ID, hardfork: "london" },
  wallet: {
    accounts: [
      { secretKey: deployerKey, balance: "0x56BC75E2D63100000" },
      { secretKey: relayerKey, balance: "0x56BC75E2D63100000" },
    ],
  },
  logging: { quiet: true },
});
const chain = defineChain({
  id: CHAIN_ID,
  name: "e2e",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost"] } },
});
// Ganache reports reverts as code -32000; real nodes (and viem) use code 3 "execution reverted"
// with the revert data, which is what lets viem decode Qeep's custom errors. Normalise it.
const transport = custom({
  request: async (args: { method: string; params?: unknown }) => {
    try {
      return await provider.request(args as never);
    } catch (e) {
      const err = e as { data?: unknown; message?: string };
      if (typeof err.data === "string" && err.data.startsWith("0x")) {
        throw { code: 3, message: "execution reverted", data: err.data };
      }
      throw e;
    }
  },
});
const pub = createPublicClient({ chain, transport });
const deployer = createWalletClient({ chain, transport, account: privateKeyToAccount(deployerKey) });
const relayer = createWalletClient({ chain, transport, account: privateKeyToAccount(relayerKey) });

async function send(hash: Promise<Hex>) {
  const receipt = await pub.waitForTransactionReceipt({ hash: await hash });
  assert.equal(receipt.status, "success");
  return receipt;
}

async function expectRevert(promise: Promise<unknown>, name: string) {
  try {
    await promise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assert.ok(msg.includes(name), `expected revert ${name}, got: ${msg.slice(0, 300)}`);
    return;
  }
  assert.fail(`expected revert ${name}`);
}

const ok = (label: string) => console.log(`  ✓ ${label}`);

// ---------------------------------------------------------------- run
async function main() {
  console.log("Qeep e2e — compiling contracts (solc 0.8.28, london)…");
  const artifacts = compile();
  ok("contracts compile");

  const musdReceipt = await send(
    deployer.deployContract({ abi: artifacts.musd.abi, bytecode: artifacts.musd.bytecode }),
  );
  const musd = musdReceipt.contractAddress as Address;
  const factoryReceipt = await send(
    deployer.deployContract({ abi: artifacts.factory.abi, bytecode: artifacts.factory.bytecode, args: [musd] }),
  );
  const factory = factoryReceipt.contractAddress as Address;
  ok(`deployed MockMUSD ${musd} and QeepAccountFactory ${factory}`);

  // User creates a wallet in the browser.
  const phrase = createVaultPhrase();
  const seed = vaultSeedFromPhrase(phrase);
  const dailyKey = privateKeyToAccount(generatePrivateKey());
  const limit = parseUnits("500", 18);
  const firstKey = firstVaultKeyHash(seed);

  const predicted = await pub.readContract({
    address: factory,
    abi: qeepFactoryAbi,
    functionName: "predictAddress",
    args: [dailyKey.address, firstKey, limit],
  });
  await send(
    relayer.writeContract({
      address: factory,
      abi: qeepFactoryAbi,
      functionName: "createAccount",
      args: [dailyKey.address, firstKey, limit],
    }),
  );
  const account = await pub.readContract({
    address: factory,
    abi: qeepFactoryAbi,
    functionName: "accountOf",
    args: [firstKey],
  });
  assert.equal(account, predicted);
  ok("relayer created the account at the predicted address; registry finds it from the phrase");

  await send(
    deployer.writeContract({
      address: musd,
      abi: [
        {
          type: "function",
          name: "mint",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [],
        },
      ],
      functionName: "mint",
      args: [account, parseUnits("2000", 18)],
    }),
  );

  const bob = privateKeyToAccount(generatePrivateKey()).address;
  const balanceOf = (who: Address) =>
    pub.readContract({ address: musd, abi: erc20Abi, functionName: "balanceOf", args: [who] });
  const readAcc = <T>(fn: string, args: unknown[] = []) =>
    pub.readContract({
      address: account,
      abi: qeepAccountAbi,
      functionName: fn as never,
      args: args as never,
    }) as Promise<T>;

  // ---- Daily key spend (gasless, relayed)
  const spendArgs = async (signer: typeof dailyKey, amount: bigint) => {
    const nonce = await readAcc<bigint>("spendNonce");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
    const digest = spendDigest({ chainId: CHAIN_ID, account, nonce, to: bob, amount, deadline });
    const onchain = await readAcc<Hex>("spendDigest", [nonce, bob, amount, deadline]);
    assert.equal(digest, onchain, "SDK spend digest matches contract");
    const signature = await signer.signMessage({ message: { raw: digest } });
    return [bob, amount, deadline, signature] as const;
  };
  const spend = async (signer: typeof dailyKey, amount: bigint) =>
    relayer.writeContract({
      address: account,
      abi: qeepAccountAbi,
      functionName: "spend",
      args: await spendArgs(signer, amount),
    });
  // eth_call so the custom error name is decoded from the ABI
  const simulateSpend = async (signer: typeof dailyKey, amount: bigint) =>
    pub.simulateContract({
      account: relayer.account,
      address: account,
      abi: qeepAccountAbi,
      functionName: "spend",
      args: await spendArgs(signer, amount),
    });

  await send(spend(dailyKey, parseUnits("200", 18)));
  assert.equal(await balanceOf(bob), parseUnits("200", 18));
  assert.equal(await readAcc<bigint>("remainingToday"), parseUnits("300", 18));
  ok("Daily key sent 200 MUSD through the relayer; 300 left today");

  await expectRevert(simulateSpend(dailyKey, parseUnits("600", 18)), "OverDailyLimit");
  ok("Daily key blocked above the limit (OverDailyLimit)");

  // ---- Vault Key: large send
  const vault = async (target: Address, data: Hex, s: Hex = seed) => {
    const nonce = await readAcc<bigint>("vaultNonce");
    const currentKeyHash = await readAcc<Hex>("vaultKeyHash");
    const signed = signVaultAction({ seed: s, chainId: CHAIN_ID, account, nonce, currentKeyHash, target, data });
    const onchain = await readAcc<Hex>("vaultDigest", [nonce, target, 0n, data, signed.nextKeyHash]);
    assert.equal(
      vaultDigest({ chainId: CHAIN_ID, account, nonce, target, value: 0n, data, nextKeyHash: signed.nextKeyHash }),
      onchain,
      "SDK vault digest matches contract",
    );
    return {
      signed,
      tx: relayer.writeContract({
        address: account,
        abi: qeepAccountAbi,
        functionName: "vaultExecute",
        args: [target, 0n, data, signed.nextKeyHash, signed.signature as never],
      }),
    };
  };

  const first = await vault(musd, musdTransferCall(bob, parseUnits("1500", 18)));
  const r1 = await send(first.tx);
  assert.equal(await balanceOf(bob), parseUnits("1700", 18));
  assert.equal(await readAcc<bigint>("vaultNonce"), 1n);
  ok(`Vault Key (WOTS, signed in TypeScript) sent 1,500 MUSD; verified on-chain — gas used ${r1.gasUsed}`);

  await expectRevert(
    pub.simulateContract({
      account: relayer.account,
      address: account,
      abi: qeepAccountAbi,
      functionName: "vaultExecute",
      args: [
        musd,
        0n,
        musdTransferCall(bob, parseUnits("1500", 18)),
        first.signed.nextKeyHash,
        first.signed.signature as never,
      ],
    }),
    "BadVaultKey",
  );
  ok("replaying a used one-time key is rejected (BadVaultKey)");

  const failing = await vault(musd, musdTransferCall(bob, parseUnits("999999", 18)));
  const rf = await send(failing.tx);
  const failedEvents = parseEventLogs({ abi: qeepAccountAbi, eventName: "VaultCallFailed", logs: rf.logs });
  assert.equal(failedEvents.length, 1);
  assert.equal(await readAcc<bigint>("vaultNonce"), 2n);
  assert.equal(await balanceOf(bob), parseUnits("1700", 18));
  ok("a failing vault action still retires its one-time key (VaultCallFailed, nothing moved)");

  const wrongSeed = vaultSeedFromPhrase(createVaultPhrase());
  assert.throws(
    () =>
      signVaultAction({
        seed: wrongSeed,
        chainId: CHAIN_ID,
        account,
        nonce: 1n,
        currentKeyHash: first.signed.nextKeyHash,
        target: musd,
        data: "0x",
      }),
    WrongVaultKeyError,
  );
  ok("a different phrase is refused before signing");

  // ---- Vault Key: settings
  await send((await vault(account, setDailyLimitCall(parseUnits("1000", 18)))).tx);
  assert.equal(await readAcc<bigint>("dailyLimit"), parseUnits("1000", 18));
  ok("Vault Key changed the daily limit to 1,000 MUSD");

  // ---- Restore on a new device: new Daily key becomes owner
  const newDevice = privateKeyToAccount(generatePrivateKey());
  await send((await vault(account, setOwnerCall(newDevice.address))).tx);
  assert.equal(await readAcc<Address>("owner"), newDevice.address);
  await expectRevert(simulateSpend(dailyKey, parseUnits("10", 18)), "BadSignature");
  await send(spend(newDevice, parseUnits("10", 18)));
  ok("restore flow: new device key took over, old Daily key no longer works");

  assert.equal(await readAcc<bigint>("vaultNonce"), 4n);
  console.log("\nAll Qeep end-to-end checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

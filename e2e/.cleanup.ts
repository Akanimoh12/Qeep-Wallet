
// Throwaway: unwinds the video account (Stability Pool, loan) and returns its funds to the funder.
import { readFileSync } from "node:fs";
import { createPublicClient, formatUnits, http, type Address, type Hex } from "viem";
import {
  closeTroveCall, erc20Abi, MEZO_CONTRACTS, mezoTestnet, musdTransferCall, qeepAccountAbi, readMezoPosition,
  signVaultAction, TroveStatus, vaultSeedFromPhrase, withdrawFromSPCall,
} from "../packages/sdk/src/index";

const { account, phrase } = JSON.parse(readFileSync(process.argv[2], "utf8")) as { account: Address; phrase: string };
const FUNDER = "0x9bcf302cFCB64406b557342c2715e85Ac62A4693" as Address;
const APP = process.env.QEEP_URL ?? "http://localhost:3000";
const mz = MEZO_CONTRACTS[mezoTestnet.id];
const pub = createPublicClient({ chain: mezoTestnet, transport: http(undefined, { retryCount: 6 }) });
const seed = vaultSeedFromPhrase(phrase);

async function vault(label: string, target: Address, data: Hex, value = 0n) {
  const [nonce, currentKeyHash] = await Promise.all([
    pub.readContract({ address: account, abi: qeepAccountAbi, functionName: "vaultNonce" }),
    pub.readContract({ address: account, abi: qeepAccountAbi, functionName: "vaultKeyHash" }),
  ]);
  const s = signVaultAction({ seed, chainId: mezoTestnet.id, account, nonce, currentKeyHash, target, data, value });
  const body = { action: "vault", account, target, value: value.toString(), data, nextKeyHash: s.nextKeyHash, signature: s.signature };
  const r = await (await fetch(`${APP}/api/relay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  if (r.error) throw new Error(`${label}: ${r.error}`);
  await pub.waitForTransactionReceipt({ hash: r.hash });
  console.log(`  ${label}: ${r.hash}`);
}

const p = await readMezoPosition(pub, mz, account);
if (p.stabilityPool.deposit > 0n) await vault("withdraw SP", mz.stabilityPool, withdrawFromSPCall(p.stabilityPool.deposit));
if (p.trove.status === TroveStatus.Active) await vault("close loan", mz.borrowerOperations, closeTroveCall());
const musd = await pub.readContract({ address: mz.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] });
if (musd > 0n) await vault(`return ${formatUnits(musd, 18)} MUSD`, mz.musd, musdTransferCall(FUNDER, musd));
const btc = await pub.getBalance({ address: account });
if (btc > 0n) await vault(`return ${formatUnits(btc, 18)} BTC`, FUNDER, "0x", btc);
console.log("funder BTC now", formatUnits(await pub.getBalance({ address: FUNDER }), 18));

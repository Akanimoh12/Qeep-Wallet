import { encodeFunctionData, maxUint256, parseAbi, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { erc20Abi } from "./abi";
import { MUSD_MAINNET, MUSD_TESTNET, mezoMainnet, mezoTestnet } from "./chains";

/**
 * Mezo protocol integration: MUSD borrowing (troves) and the Stability Pool.
 * Every write here is calldata for a Qeep Vault Key action, so it runs as the Qeep account
 * (msg.sender = account) and is approved with a post-quantum signature.
 */

export type MezoContracts = {
  musd: Address;
  borrowerOperations: Address;
  troveManager: Address;
  priceFeed: Address;
  stabilityPool: Address;
  hintHelpers: Address;
  sortedTroves: Address;
};

/** From github.com/mezo-org/musd, solidity/artifacts/deployments/{matsnet,mainnet}. */
export const MEZO_CONTRACTS: Record<number, MezoContracts> = {
  [mezoTestnet.id]: {
    musd: MUSD_TESTNET,
    borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
    troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
    priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
    stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
    hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
    sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  },
  [mezoMainnet.id]: {
    musd: MUSD_MAINNET,
    borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
    troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
    priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
    stabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32",
    hintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
    sortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
  },
};

export const borrowerOperationsAbi = parseAbi([
  "function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) payable",
  "function addColl(address _upperHint, address _lowerHint) payable",
  "function withdrawColl(uint256 _amount, address _upperHint, address _lowerHint)",
  "function withdrawMUSD(uint256 _amount, address _upperHint, address _lowerHint)",
  "function repayMUSD(uint256 _amount, address _upperHint, address _lowerHint)",
  "function closeTrove()",
  "function minNetDebt() view returns (uint256)",
  "function MUSD_GAS_COMPENSATION() view returns (uint256)",
  "function getBorrowingFee(uint256 _debt) view returns (uint256)",
]);

export const troveManagerAbi = parseAbi([
  "function getTroveStatus(address _borrower) view returns (uint256)",
  "function getEntireDebtAndColl(address _borrower) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingCollateral, uint256 pendingPrincipal, uint256 pendingInterest)",
  "function getCurrentICR(address _borrower, uint256 _price) view returns (uint256)",
  "function getTroveInterestRate(address _borrower) view returns (uint16)",
  "function getTCR(uint256 _price) view returns (uint256)",
  "function checkRecoveryMode(uint256 _price) view returns (bool)",
]);

export const priceFeedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);

export const stabilityPoolAbi = parseAbi([
  "function provideToSP(uint256 _amount)",
  "function withdrawFromSP(uint256 _amount)",
  "function getCompoundedMUSDDeposit(address _depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address _depositor) view returns (uint256)",
  "function getTotalMUSDDeposits() view returns (uint256)",
]);

export const hintHelpersAbi = parseAbi([
  "function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed) view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)",
]);

export const sortedTrovesAbi = parseAbi([
  "function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) view returns (address, address)",
  "function getSize() view returns (uint256)",
]);

/** Liquity-style constants used by Mezo. */
export const MCR = 110n * 10n ** 16n; // 110% minimum collateral ratio
export const CCR = 150n * 10n ** 16n; // 150% critical (recovery mode) ratio

export enum TroveStatus {
  None = 0,
  Active = 1,
  ClosedByOwner = 2,
  ClosedByLiquidation = 3,
  ClosedByRedemption = 4,
}

export type MezoPosition = {
  /** BTC price in USD, 18 decimals. */
  price: bigint;
  recoveryMode: boolean;
  /** Total collateral ratio of the whole system, 18 decimals (1e18 = 100%). */
  tcr: bigint;
  minNetDebt: bigint;
  gasCompensation: bigint;
  trove: {
    status: TroveStatus;
    /** BTC collateral, 18 decimals. */
    coll: bigint;
    principal: bigint;
    interest: bigint;
    /** Everything owed: principal + interest. */
    debt: bigint;
    /** Collateral ratio at the current price, 18 decimals. 0 when there is no trove. */
    icr: bigint;
    /** Annual interest rate in basis points. */
    interestRateBps: number;
    /** BTC price at which the trove falls to the 110% minimum. */
    liquidationPrice: bigint;
  };
  stabilityPool: { deposit: bigint; btcGain: bigint };
  /** MUSD the account has already allowed the Stability Pool to pull. */
  spAllowance: bigint;
};

export async function readMezoPosition(client: PublicClient, c: MezoContracts, account: Address): Promise<MezoPosition> {
  const price = await client.readContract({ address: c.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" });
  const [status, debtAndColl, icr, rate, tcr, recoveryMode, minNetDebt, gasCompensation, deposit, btcGain, spAllowance] =
    await Promise.all([
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] }),
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [account] }),
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "getCurrentICR", args: [account, price] }),
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "getTroveInterestRate", args: [account] }),
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "getTCR", args: [price] }),
      client.readContract({ address: c.troveManager, abi: troveManagerAbi, functionName: "checkRecoveryMode", args: [price] }),
      client.readContract({ address: c.borrowerOperations, abi: borrowerOperationsAbi, functionName: "minNetDebt" }),
      client.readContract({ address: c.borrowerOperations, abi: borrowerOperationsAbi, functionName: "MUSD_GAS_COMPENSATION" }),
      client.readContract({ address: c.stabilityPool, abi: stabilityPoolAbi, functionName: "getCompoundedMUSDDeposit", args: [account] }),
      client.readContract({ address: c.stabilityPool, abi: stabilityPoolAbi, functionName: "getDepositorCollateralGain", args: [account] }),
      client.readContract({ address: c.musd, abi: erc20Abi, functionName: "allowance", args: [account, c.stabilityPool] }),
    ]);
  const [coll, principal, interest, pendingColl, pendingPrincipal, pendingInterest] = debtAndColl;
  const totalColl = coll + pendingColl;
  const totalPrincipal = principal + pendingPrincipal;
  const totalInterest = interest + pendingInterest;
  const debt = totalPrincipal + totalInterest;
  const active = Number(status) === TroveStatus.Active;
  return {
    price,
    recoveryMode,
    tcr,
    minNetDebt,
    gasCompensation,
    trove: {
      status: Number(status) as TroveStatus,
      coll: totalColl,
      principal: totalPrincipal,
      interest: totalInterest,
      debt,
      icr: active ? icr : 0n,
      interestRateBps: Number(rate),
      liquidationPrice: active && totalColl > 0n ? (debt * MCR) / totalColl : 0n,
    },
    stabilityPool: { deposit, btcGain },
    spAllowance,
  };
}

/** Collateral ratio (18 decimals) for a given collateral, debt and price. */
export function collateralRatio(coll: bigint, debt: bigint, price: bigint): bigint {
  return debt === 0n ? 0n : (coll * price) / debt;
}

/** Total debt Mezo records when opening a trove: requested + borrowing fee + gas compensation. */
export async function openTroveDebt(client: PublicClient, c: MezoContracts, borrow: bigint): Promise<bigint> {
  const [fee, gasComp] = await Promise.all([
    client.readContract({ address: c.borrowerOperations, abi: borrowerOperationsAbi, functionName: "getBorrowingFee", args: [borrow] }),
    client.readContract({ address: c.borrowerOperations, abi: borrowerOperationsAbi, functionName: "MUSD_GAS_COMPENSATION" }),
  ]);
  return borrow + fee + gasComp;
}

/**
 * Sorted-troves insert hints for a trove that will have `coll` and `principal` after the action.
 * Good hints keep Mezo's sorted list walk short; zero hints still work but cost far more gas.
 */
export async function troveHints(
  client: PublicClient,
  c: MezoContracts,
  coll: bigint,
  principal: bigint,
): Promise<{ upper: Address; lower: Address }> {
  if (principal === 0n) return { upper: zeroAddress, lower: zeroAddress };
  const nicr = (coll * 10n ** 20n) / principal;
  const size = await client.readContract({ address: c.sortedTroves, abi: sortedTrovesAbi, functionName: "getSize" });
  const trials = BigInt(Math.min(Math.max(Math.ceil(15 * Math.sqrt(Number(size))), 10), 500));
  const [hint] = await client.readContract({
    address: c.hintHelpers,
    abi: hintHelpersAbi,
    functionName: "getApproxHint",
    args: [nicr, trials, 42n],
  });
  const [upper, lower] = await client.readContract({
    address: c.sortedTroves,
    abi: sortedTrovesAbi,
    functionName: "findInsertPosition",
    args: [nicr, hint, hint],
  });
  return { upper, lower };
}

// ------------------------------------------------------------------ calldata for Vault Key actions

export const openTroveCall = (debt: bigint, upper: Address, lower: Address): Hex =>
  encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "openTrove", args: [debt, upper, lower] });

export const addCollCall = (upper: Address, lower: Address): Hex =>
  encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "addColl", args: [upper, lower] });

export const withdrawCollCall = (amount: bigint, upper: Address, lower: Address): Hex =>
  encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "withdrawColl", args: [amount, upper, lower] });

export const borrowMoreCall = (amount: bigint, upper: Address, lower: Address): Hex =>
  encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "withdrawMUSD", args: [amount, upper, lower] });

export const repayCall = (amount: bigint, upper: Address, lower: Address): Hex =>
  encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "repayMUSD", args: [amount, upper, lower] });

export const closeTroveCall = (): Hex => encodeFunctionData({ abi: borrowerOperationsAbi, functionName: "closeTrove" });

export const provideToSPCall = (amount: bigint): Hex =>
  encodeFunctionData({ abi: stabilityPoolAbi, functionName: "provideToSP", args: [amount] });

export const withdrawFromSPCall = (amount: bigint): Hex =>
  encodeFunctionData({ abi: stabilityPoolAbi, functionName: "withdrawFromSP", args: [amount] });

/** MUSD approval, needed once before Stability Pool deposits (the pool uses transferFrom). */
export const approveCall = (spender: Address, amount: bigint = maxUint256): Hex =>
  encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });

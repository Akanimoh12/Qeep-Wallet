import { parseAbi } from "viem";

export const qeepAccountAbi = parseAbi([
  "function musd() view returns (address)",
  "function owner() view returns (address)",
  "function vaultKeyHash() view returns (bytes32)",
  "function vaultNonce() view returns (uint256)",
  "function spendNonce() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function remainingToday() view returns (uint256)",
  "function spend(address to, uint256 amount, uint256 deadline, bytes signature)",
  "function spendDigest(uint256 nonce, address to, uint256 amount, uint256 deadline) view returns (bytes32)",
  "function vaultExecute(address target, uint256 value, bytes data, bytes32 nextKeyHash, bytes32[67] signature) returns (bool success, bytes result)",
  "function vaultDigest(uint256 nonce, address target, uint256 value, bytes data, bytes32 nextKeyHash) view returns (bytes32)",
  "function setOwner(address newOwner)",
  "function setDailyLimit(uint256 newLimit)",
  "event Spent(address indexed to, uint256 amount, uint256 nonce)",
  "event VaultExecuted(address indexed target, uint256 value, bytes4 selector, uint256 nonce)",
  "event VaultCallFailed(uint256 indexed nonce, bytes reason)",
  "event OwnerChanged(address indexed previousOwner, address indexed newOwner)",
  "event DailyLimitChanged(uint256 previousLimit, uint256 newLimit)",
  "error Expired()",
  "error BadSignature()",
  "error OverDailyLimit(uint256 requested, uint256 remaining)",
  "error BadVaultKey()",
  "error ZeroValue()",
  "error OnlySelf()",
  "error TransferFailed()",
]);

export const qeepFactoryAbi = parseAbi([
  "function musd() view returns (address)",
  "function accountOf(bytes32 firstVaultKeyHash) view returns (address)",
  "function isQeepAccount(address account) view returns (bool)",
  "function createAccount(address owner, bytes32 firstVaultKeyHash, uint256 dailyLimit) returns (address)",
  "function predictAddress(address owner, bytes32 firstVaultKeyHash, uint256 dailyLimit) view returns (address)",
  "event AccountCreated(address indexed account, address indexed owner, bytes32 indexed firstVaultKeyHash, uint256 dailyLimit)",
  "error AlreadyExists(address account)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

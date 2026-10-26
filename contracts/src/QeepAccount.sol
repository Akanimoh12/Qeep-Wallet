// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {WOTS} from "./WOTS.sol";

/// @title QeepAccount
/// @notice A MUSD smart account with two keys:
///         - the Daily key (ECDSA) can send MUSD up to a daily limit;
///         - the Vault Key (post-quantum, WOTS) approves everything else: large sends,
///           any other call, changing the limit and replacing the Daily key.
/// @dev Every action is authorised by a signature, not by msg.sender, so a relayer can
///      submit transactions and pay gas for the user.
contract QeepAccount {
    bytes32 public constant SPEND_TYPEHASH = keccak256(
        "QeepSpend(uint256 chainId,address account,uint256 nonce,address to,uint256 amount,uint256 deadline)"
    );
    bytes32 public constant VAULT_TYPEHASH = keccak256(
        "QeepVaultExecute(uint256 chainId,address account,uint256 nonce,address target,uint256 value,bytes32 dataHash,bytes32 nextKeyHash)"
    );

    uint256 private constant SECP256K1_HALF_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    IERC20 public immutable musd;

    /// @notice Address of the Daily key.
    address public owner;
    /// @notice Hash of the current one-time Vault Key public key.
    bytes32 public vaultKeyHash;
    /// @notice Index of the current Vault Key. Increases by one after each vault action.
    uint256 public vaultNonce;
    /// @notice Replay protection for Daily key spends.
    uint256 public spendNonce;
    /// @notice Most MUSD (in wei) the Daily key may send per UTC day.
    uint256 public dailyLimit;
    uint256 public spentToday;
    uint256 public currentDay;

    event Spent(address indexed to, uint256 amount, uint256 nonce);
    event VaultExecuted(address indexed target, uint256 value, bytes4 selector, uint256 nonce);
    event VaultCallFailed(uint256 indexed nonce, bytes reason);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event DailyLimitChanged(uint256 previousLimit, uint256 newLimit);

    error Expired();
    error BadSignature();
    error OverDailyLimit(uint256 requested, uint256 remaining);
    error BadVaultKey();
    error ZeroValue();
    error OnlySelf();
    error TransferFailed();

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    constructor(IERC20 musd_, address owner_, bytes32 vaultKeyHash_, uint256 dailyLimit_) {
        if (address(musd_) == address(0) || owner_ == address(0) || vaultKeyHash_ == bytes32(0)) {
            revert ZeroValue();
        }
        musd = musd_;
        owner = owner_;
        vaultKeyHash = vaultKeyHash_;
        dailyLimit = dailyLimit_;
        emit OwnerChanged(address(0), owner_);
        emit DailyLimitChanged(0, dailyLimit_);
    }

    receive() external payable {}

    // ---------------------------------------------------------------------
    // Daily key: small MUSD sends
    // ---------------------------------------------------------------------

    /// @notice Sends MUSD within the daily limit, authorised by the Daily key.
    /// @param signature EIP-191 personal_sign signature over `spendDigest(...)`.
    function spend(address to, uint256 amount, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert Expired();
        if (to == address(0) || amount == 0) revert ZeroValue();

        bytes32 digest = spendDigest(spendNonce, to, amount, deadline);
        if (_recover(_toEthSignedMessageHash(digest), signature) != owner) revert BadSignature();

        uint256 nonce = spendNonce;
        unchecked {
            spendNonce = nonce + 1;
        }
        _useDailyAllowance(amount);
        _transferMusd(to, amount);
        emit Spent(to, amount, nonce);
    }

    function spendDigest(uint256 nonce, address to, uint256 amount, uint256 deadline) public view returns (bytes32) {
        return keccak256(abi.encode(SPEND_TYPEHASH, block.chainid, address(this), nonce, to, amount, deadline));
    }

    /// @notice MUSD the Daily key can still send today.
    function remainingToday() public view returns (uint256) {
        uint256 spent = (block.timestamp / 1 days == currentDay) ? spentToday : 0;
        return spent >= dailyLimit ? 0 : dailyLimit - spent;
    }

    // ---------------------------------------------------------------------
    // Vault Key: everything else
    // ---------------------------------------------------------------------

    /// @notice Executes any call from this account, authorised by the current one-time Vault Key.
    /// @dev A valid signature always retires the key, whether or not the call succeeds.
    /// @param nextKeyHash Hash of the next Vault Key public key. The current key is retired.
    /// @param signature   WOTS signature over `vaultDigest(...)`.
    /// @return success    Whether the call to `target` succeeded.
    /// @return result     The call's return data, or its revert data when it failed.
    function vaultExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 nextKeyHash,
        bytes32[67] calldata signature
    ) external returns (bool success, bytes memory result) {
        if (nextKeyHash == bytes32(0)) revert ZeroValue();

        uint256 nonce = vaultNonce;
        bytes32 digest = vaultDigest(nonce, target, value, data, nextKeyHash);
        if (WOTS.publicKeyHash(digest, signature) != vaultKeyHash) revert BadVaultKey();

        // Retire the one-time key before the external call.
        vaultKeyHash = nextKeyHash;
        unchecked {
            vaultNonce = nonce + 1;
        }

        // The key stays retired even if the call fails. Reverting here would leave a published
        // signature for a key that is still active, and signing a different action with it later
        // would weaken WOTS. Callers check `success` (or the VaultCallFailed event).
        (success, result) = target.call{value: value}(data);
        if (success) {
            emit VaultExecuted(target, value, data.length >= 4 ? bytes4(data[:4]) : bytes4(0), nonce);
        } else {
            emit VaultCallFailed(nonce, result);
        }
    }

    function vaultDigest(uint256 nonce, address target, uint256 value, bytes calldata data, bytes32 nextKeyHash)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(VAULT_TYPEHASH, block.chainid, address(this), nonce, target, value, keccak256(data), nextKeyHash)
        );
    }

    // ---------------------------------------------------------------------
    // Settings, only reachable through vaultExecute(target = this)
    // ---------------------------------------------------------------------

    /// @notice Replaces the Daily key, for example after losing a phone.
    function setOwner(address newOwner) external onlySelf {
        if (newOwner == address(0)) revert ZeroValue();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setDailyLimit(uint256 newLimit) external onlySelf {
        emit DailyLimitChanged(dailyLimit, newLimit);
        dailyLimit = newLimit;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _useDailyAllowance(uint256 amount) private {
        uint256 today = block.timestamp / 1 days;
        if (today != currentDay) {
            currentDay = today;
            spentToday = 0;
        }
        uint256 remaining = spentToday >= dailyLimit ? 0 : dailyLimit - spentToday;
        if (amount > remaining) revert OverDailyLimit(amount, remaining);
        spentToday += amount;
    }

    function _transferMusd(address to, uint256 amount) private {
        (bool ok, bytes memory ret) = address(musd).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _toEthSignedMessageHash(bytes32 digest) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
    }

    function _recover(bytes32 hash, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        if (uint256(s) > SECP256K1_HALF_N || (v != 27 && v != 28)) return address(0);
        return ecrecover(hash, v, r, s);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {QeepAccount} from "./QeepAccount.sol";

/// @title QeepAccountFactory
/// @notice Deploys Qeep accounts with CREATE2 and keeps a registry so a wallet can be
///         found again from its first Vault Key hash (wallet restore from the 24 words).
contract QeepAccountFactory {
    IERC20 public immutable musd;

    /// @notice First Vault Key hash => account. Used to restore a wallet from its phrase.
    mapping(bytes32 => address) public accountOf;
    /// @notice True for every account this factory deployed. The relayer only serves these.
    mapping(address => bool) public isQeepAccount;

    event AccountCreated(
        address indexed account, address indexed owner, bytes32 indexed firstVaultKeyHash, uint256 dailyLimit
    );

    error AlreadyExists(address account);

    constructor(IERC20 musd_) {
        musd = musd_;
    }

    function createAccount(address owner, bytes32 firstVaultKeyHash, uint256 dailyLimit)
        external
        returns (address account)
    {
        address existing = accountOf[firstVaultKeyHash];
        if (existing != address(0)) revert AlreadyExists(existing);

        account = address(new QeepAccount{salt: firstVaultKeyHash}(musd, owner, firstVaultKeyHash, dailyLimit));
        accountOf[firstVaultKeyHash] = account;
        isQeepAccount[account] = true;
        emit AccountCreated(account, owner, firstVaultKeyHash, dailyLimit);
    }

    /// @notice Address `createAccount` would deploy to with these arguments.
    function predictAddress(address owner, bytes32 firstVaultKeyHash, uint256 dailyLimit)
        external
        view
        returns (address)
    {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(QeepAccount).creationCode, abi.encode(musd, owner, firstVaultKeyHash, dailyLimit))
        );
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), firstVaultKeyHash, initCodeHash))))
        );
    }
}

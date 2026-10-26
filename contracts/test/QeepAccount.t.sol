// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {QeepAccount} from "../src/QeepAccount.sol";
import {QeepAccountFactory} from "../src/QeepAccountFactory.sol";
import {MockMUSD} from "./mocks/MockMUSD.sol";
import {WOTSSigner} from "./utils/WOTSSigner.sol";

contract QeepAccountTest is Test {
    MockMUSD internal musd;
    QeepAccountFactory internal factory;
    QeepAccount internal account;

    uint256 internal dailyKey = 0xA11CE;
    address internal owner;
    bytes32 internal constant SEED = keccak256("qeep test vault seed");
    address internal bob = address(0xB0B);
    uint256 internal constant LIMIT = 500e18;

    function setUp() public {
        vm.warp(1_800_000_000);
        owner = vm.addr(dailyKey);
        musd = new MockMUSD();
        factory = new QeepAccountFactory(IERC20(address(musd)));

        bytes32 firstKey = WOTSSigner.keyHash(SEED, 0);
        address predicted = factory.predictAddress(owner, firstKey, LIMIT);
        account = QeepAccount(payable(factory.createAccount(owner, firstKey, LIMIT)));
        assertEq(address(account), predicted, "predicted address");

        musd.mint(address(account), 2_000e18);
    }

    // ------------------------------------------------------------------ helpers

    function _spendSig(uint256 key, uint256 nonce, address to, uint256 amount, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = account.spendDigest(nonce, to, amount, deadline);
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _vault(address target, uint256 value, bytes memory data) internal {
        uint32 n = uint32(account.vaultNonce());
        bytes32 next = WOTSSigner.keyHash(SEED, n + 1);
        bytes32 digest = account.vaultDigest(n, target, value, data, next);
        bytes32[67] memory sig = WOTSSigner.sign(SEED, n, digest);
        (bool success,) = account.vaultExecute(target, value, data, next, sig);
        assertTrue(success, "vault call succeeded");
    }

    // ------------------------------------------------------------------ daily key

    function test_SpendWithinLimit() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _spendSig(dailyKey, 0, bob, 200e18, deadline);
        account.spend(bob, 200e18, deadline, sig);

        assertEq(musd.balanceOf(bob), 200e18);
        assertEq(account.remainingToday(), 300e18);
        assertEq(account.spendNonce(), 1);
    }

    function test_SpendOverLimitReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _spendSig(dailyKey, 0, bob, 600e18, deadline);
        vm.expectRevert(abi.encodeWithSelector(QeepAccount.OverDailyLimit.selector, 600e18, LIMIT));
        account.spend(bob, 600e18, deadline, sig);
    }

    function test_SpendLimitAccumulatesAndResetsNextDay() public {
        uint256 deadline = block.timestamp + 3 days;
        account.spend(bob, 400e18, deadline, _spendSig(dailyKey, 0, bob, 400e18, deadline));

        bytes memory second = _spendSig(dailyKey, 1, bob, 200e18, deadline);
        vm.expectRevert(abi.encodeWithSelector(QeepAccount.OverDailyLimit.selector, 200e18, 100e18));
        account.spend(bob, 200e18, deadline, second);

        vm.warp(block.timestamp + 1 days);
        assertEq(account.remainingToday(), LIMIT);
        account.spend(bob, 200e18, deadline, second);
        assertEq(musd.balanceOf(bob), 600e18);
    }

    function test_SpendWrongKeyReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _spendSig(0xBAD, 0, bob, 100e18, deadline);
        vm.expectRevert(QeepAccount.BadSignature.selector);
        account.spend(bob, 100e18, deadline, sig);
    }

    function test_SpendReplayReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _spendSig(dailyKey, 0, bob, 100e18, deadline);
        account.spend(bob, 100e18, deadline, sig);
        vm.expectRevert(QeepAccount.BadSignature.selector);
        account.spend(bob, 100e18, deadline, sig);
    }

    function test_SpendExpiredReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _spendSig(dailyKey, 0, bob, 100e18, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(QeepAccount.Expired.selector);
        account.spend(bob, 100e18, deadline, sig);
    }

    // ------------------------------------------------------------------ vault key

    function test_VaultLargeTransfer() public {
        _vault(address(musd), 0, abi.encodeCall(IERC20.transfer, (bob, 1_500e18)));
        assertEq(musd.balanceOf(bob), 1_500e18);
        assertEq(account.vaultNonce(), 1);
        assertEq(account.vaultKeyHash(), WOTSSigner.keyHash(SEED, 1));
    }

    function test_VaultKeysRotateAcrossActions() public {
        _vault(address(musd), 0, abi.encodeCall(IERC20.transfer, (bob, 100e18)));
        _vault(address(musd), 0, abi.encodeCall(IERC20.transfer, (bob, 100e18)));
        _vault(address(musd), 0, abi.encodeCall(IERC20.transfer, (bob, 100e18)));
        assertEq(account.vaultNonce(), 3);
        assertEq(musd.balanceOf(bob), 300e18);
    }

    function test_VaultReplayOfOldKeyReverts() public {
        bytes memory data = abi.encodeCall(IERC20.transfer, (bob, 100e18));
        bytes32 next = WOTSSigner.keyHash(SEED, 1);
        bytes32[67] memory sig = WOTSSigner.sign(SEED, 0, account.vaultDigest(0, address(musd), 0, data, next));
        account.vaultExecute(address(musd), 0, data, next, sig);

        vm.expectRevert(QeepAccount.BadVaultKey.selector);
        account.vaultExecute(address(musd), 0, data, next, sig);
    }

    function test_VaultWrongSeedReverts() public {
        bytes memory data = abi.encodeCall(IERC20.transfer, (bob, 100e18));
        bytes32 wrongSeed = keccak256("someone else");
        bytes32 next = WOTSSigner.keyHash(wrongSeed, 1);
        bytes32[67] memory sig = WOTSSigner.sign(wrongSeed, 0, account.vaultDigest(0, address(musd), 0, data, next));
        vm.expectRevert(QeepAccount.BadVaultKey.selector);
        account.vaultExecute(address(musd), 0, data, next, sig);
    }

    function test_VaultTamperedCallReverts() public {
        bytes memory data = abi.encodeCall(IERC20.transfer, (bob, 100e18));
        bytes32 next = WOTSSigner.keyHash(SEED, 1);
        bytes32[67] memory sig = WOTSSigner.sign(SEED, 0, account.vaultDigest(0, address(musd), 0, data, next));

        bytes memory stolen = abi.encodeCall(IERC20.transfer, (address(0xEE11), 2_000e18));
        vm.expectRevert(QeepAccount.BadVaultKey.selector);
        account.vaultExecute(address(musd), 0, stolen, next, sig);
    }

    function test_VaultFailedCallStillRetiresKey() public {
        // More than the account holds: MockMUSD reverts, but the one-time key must still be retired.
        bytes memory data = abi.encodeCall(IERC20.transfer, (bob, 5_000e18));
        bytes32 next = WOTSSigner.keyHash(SEED, 1);
        bytes32[67] memory sig = WOTSSigner.sign(SEED, 0, account.vaultDigest(0, address(musd), 0, data, next));

        (bool success,) = account.vaultExecute(address(musd), 0, data, next, sig);
        assertFalse(success);
        assertEq(account.vaultNonce(), 1);
        assertEq(account.vaultKeyHash(), next);
        assertEq(musd.balanceOf(bob), 0);

        vm.expectRevert(QeepAccount.BadVaultKey.selector);
        account.vaultExecute(address(musd), 0, data, next, sig);
    }

    function test_VaultChangesLimitAndOwner() public {
        _vault(address(account), 0, abi.encodeCall(QeepAccount.setDailyLimit, (50e18)));
        assertEq(account.dailyLimit(), 50e18);

        address newOwner = vm.addr(0xC0FFEE);
        _vault(address(account), 0, abi.encodeCall(QeepAccount.setOwner, (newOwner)));
        assertEq(account.owner(), newOwner);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory oldSig = _spendSig(dailyKey, 0, bob, 10e18, deadline);
        vm.expectRevert(QeepAccount.BadSignature.selector);
        account.spend(bob, 10e18, deadline, oldSig);

        account.spend(bob, 10e18, deadline, _spendSig(0xC0FFEE, 0, bob, 10e18, deadline));
        assertEq(musd.balanceOf(bob), 10e18);
    }

    function test_SettingsOnlySelf() public {
        vm.expectRevert(QeepAccount.OnlySelf.selector);
        account.setOwner(bob);
        vm.expectRevert(QeepAccount.OnlySelf.selector);
        account.setDailyLimit(1);
    }

    // ------------------------------------------------------------------ factory

    function test_FactoryRegistry() public view {
        assertEq(factory.accountOf(WOTSSigner.keyHash(SEED, 0)), address(account));
        assertTrue(factory.isQeepAccount(address(account)));
        assertFalse(factory.isQeepAccount(bob));
    }

    function test_FactoryRejectsDuplicateVaultKey() public {
        bytes32 firstKey = WOTSSigner.keyHash(SEED, 0);
        vm.expectRevert(abi.encodeWithSelector(QeepAccountFactory.AlreadyExists.selector, address(account)));
        factory.createAccount(bob, firstKey, LIMIT);
    }
}

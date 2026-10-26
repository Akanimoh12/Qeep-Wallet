// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {QeepAccountFactory} from "../src/QeepAccountFactory.sol";

/// @notice Deploys the Qeep account factory pointing at MUSD.
/// Usage (Mezo testnet):
///   forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --legacy
/// Env: DEPLOYER_PRIVATE_KEY, MUSD_ADDRESS
contract Deploy is Script {
    function run() external returns (QeepAccountFactory factory) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address musd = vm.envAddress("MUSD_ADDRESS");

        vm.startBroadcast(deployerKey);
        factory = new QeepAccountFactory(IERC20(musd));
        vm.stopBroadcast();

        console2.log("MUSD:                ", musd);
        console2.log("QeepAccountFactory:  ", address(factory));
    }
}

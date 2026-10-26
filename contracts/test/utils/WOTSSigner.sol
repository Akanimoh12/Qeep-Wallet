// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {WOTS} from "../../src/WOTS.sol";

/// @notice Test-only WOTS key derivation and signing. Mirrors packages/sdk/src/wots.ts.
library WOTSSigner {
    function secret(bytes32 seed, uint32 keyIndex, uint16 chainIndex) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(seed, keyIndex, chainIndex));
    }

    function keyHash(bytes32 seed, uint32 keyIndex) internal pure returns (bytes32) {
        bytes32[67] memory pk;
        for (uint256 i = 0; i < WOTS.LEN; ++i) {
            bytes32 x = secret(seed, keyIndex, uint16(i));
            for (uint256 j = 0; j < WOTS.W_MAX; ++j) {
                x = WOTS.step(x, i, j);
            }
            pk[i] = x;
        }
        return keccak256(abi.encodePacked(pk));
    }

    function sign(bytes32 seed, uint32 keyIndex, bytes32 message) internal pure returns (bytes32[67] memory sig) {
        uint8[67] memory d = WOTS.digits(message);
        for (uint256 i = 0; i < WOTS.LEN; ++i) {
            bytes32 x = secret(seed, keyIndex, uint16(i));
            for (uint256 j = 0; j < d[i]; ++j) {
                x = WOTS.step(x, i, j);
            }
            sig[i] = x;
        }
    }
}

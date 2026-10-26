// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title WOTS
/// @notice Winternitz one-time signature (WOTS) verification over keccak256.
/// @dev Parameters: n = 32 bytes, w = 16, 64 message digits + 3 checksum digits = 67 chains.
///      Hash-based signatures rely only on the preimage resistance of keccak256, so a
///      quantum computer gets at most a square-root speedup (Grover) instead of the full
///      break that Shor's algorithm gives against ECDSA.
///
///      Chain step:  F(x, chain, step) = keccak256(abi.encodePacked(bytes32 x, uint16 chain, uint8 step))
///      Signing:     sig[i] = chain(sk[i], i, from 0, d[i] steps)
///      Verifying:   pk[i]  = chain(sig[i], i, from d[i], 15 - d[i] steps)
///      Key hash:    keccak256(abi.encodePacked(pk[0], ..., pk[66]))
///
///      The TypeScript implementation in packages/sdk must match this file byte for byte.
library WOTS {
    uint256 internal constant LEN = 67;
    uint256 internal constant MSG_DIGITS = 64;
    uint256 internal constant W_MAX = 15;

    /// @notice Recomputes the public key hash that `sig` commits to for `message`.
    /// @dev Compare the result with the stored key hash. A wrong signature yields an unrelated hash.
    function publicKeyHash(bytes32 message, bytes32[67] calldata sig) internal pure returns (bytes32) {
        uint8[67] memory d = digits(message);
        bytes32[67] memory pk;
        for (uint256 i = 0; i < LEN; ++i) {
            bytes32 x = sig[i];
            for (uint256 j = d[i]; j < W_MAX; ++j) {
                x = step(x, i, j);
            }
            pk[i] = x;
        }
        return keccak256(abi.encodePacked(pk));
    }

    /// @notice Splits a 256-bit message into 64 base-16 digits plus a 3-digit checksum.
    function digits(bytes32 message) internal pure returns (uint8[67] memory d) {
        uint256 m = uint256(message);
        uint256 checksum = 0;
        for (uint256 i = 0; i < MSG_DIGITS; ++i) {
            uint8 v = uint8((m >> (252 - 4 * i)) & 0xF);
            d[i] = v;
            checksum += W_MAX - v;
        }
        d[64] = uint8((checksum >> 8) & 0xF);
        d[65] = uint8((checksum >> 4) & 0xF);
        d[66] = uint8(checksum & 0xF);
    }

    /// @notice One step along a hash chain, domain-separated by chain index and step index.
    function step(bytes32 x, uint256 chainIndex, uint256 stepIndex) internal pure returns (bytes32 r) {
        assembly {
            mstore(0x00, x)
            mstore(0x20, shl(240, chainIndex))
            mstore8(0x22, stepIndex)
            r := keccak256(0x00, 35)
        }
    }
}

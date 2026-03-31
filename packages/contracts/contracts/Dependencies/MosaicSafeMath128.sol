// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

// uint128 addition and subtraction, with built-in overflow protection in Solidity 0.8.x.

library MosaicSafeMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128) {
        return a + b;
    }

    function sub(uint128 a, uint128 b) internal pure returns (uint128) {
        return a - b;
    }
}

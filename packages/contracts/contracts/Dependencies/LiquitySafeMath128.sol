// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// uint128 addition and subtraction, with overflow protection.

library MosaicSafeMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128) {
        uint128 c = a + b;
        require(c >= a, "MosaicSafeMath128: addition overflow");

        return c;
    }
   
    function sub(uint128 a, uint128 b) internal pure returns (uint128) {
        require(b <= a, "MosaicSafeMath128: subtraction overflow");
        uint128 c = a - b;

        return c;
    }
}
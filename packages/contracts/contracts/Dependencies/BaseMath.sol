// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


contract BaseMath {
    uint constant public DECIMAL_PRECISION = 1e18;

    // Scaling factor to normalize 12-decimal REEF collateral to 18-decimal precision
    // Equal to 10^(18 - REEF_DECIMALS) = 10^(18 - 12) = 1e6
    uint constant public COLL_DECIMALS_OFFSET = 1e6;
}

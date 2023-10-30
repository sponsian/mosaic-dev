// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPriceFeed.sol";


interface IMosaicBase {
    function priceFeed() external view returns (IPriceFeed);
}

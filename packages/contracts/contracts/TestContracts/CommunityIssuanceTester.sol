// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../MSIC/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
    function obtainMSIC(uint _amount) external {
        msicToken.transfer(msg.sender, _amount);
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueMSIC() external returns (uint) {
        // No checks on caller address

        uint latestTotalMSICIssued = MSICSupplyCap * _getCumulativeIssuanceFraction() / DECIMAL_PRECISION;
        uint issuance = latestTotalMSICIssued - totalMSICIssued;

        totalMSICIssued = latestTotalMSICIssued;
        return issuance;
    }
}

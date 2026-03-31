// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {
    
    function unprotectedPayable() external payable {
        REEF = REEF + msg.value;
    }

    function setCurrentScale(uint128 _currentScale) external {
        currentScale = _currentScale;
    }

    function setTotalDeposits(uint _totalMEURDeposits) external {
        totalMEURDeposits = _totalMEURDeposits;
    }
}

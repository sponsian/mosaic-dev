// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncreaseMEURDebt(uint _amount) external {
        MEURDebt  = MEURDebt + _amount;
    }

    function unprotectedPayable() external payable {
        REEF = REEF + msg.value;
    }
}

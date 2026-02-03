// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncreaseMEURDebt(uint _amount) external {
        MEURDebt  = MEURDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        REEF = REEF.add(msg.value);
    }
}

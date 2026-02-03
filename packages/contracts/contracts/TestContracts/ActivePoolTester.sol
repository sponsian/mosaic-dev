// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseMEURDebt(uint _amount) external {
        MEURDebt  = MEURDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        REEF = REEF.add(msg.value);
    }
}

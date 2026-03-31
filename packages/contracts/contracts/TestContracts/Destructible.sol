// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

contract Destructible {
    
    receive() external payable {}
    
    function destruct(address payable _receiver) external {
        selfdestruct(_receiver);
    }
}

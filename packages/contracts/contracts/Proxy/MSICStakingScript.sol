// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IMSICStaking.sol";


contract MSICStakingScript is CheckContract {
    IMSICStaking immutable MSICStaking;

    constructor(address _msicStakingAddress) {
        checkContract(_msicStakingAddress);
        MSICStaking = IMSICStaking(_msicStakingAddress);
    }

    function stake(uint _MSICamount) external {
        MSICStaking.stake(_MSICamount);
    }
}

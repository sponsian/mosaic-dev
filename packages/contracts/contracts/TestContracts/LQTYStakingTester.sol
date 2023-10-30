// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../MSIC/MSICStaking.sol";


contract MSICStakingTester is MSICStaking {
    function requireCallerIsTroveManager() external view {
        _requireCallerIsTroveManager();
    }
}

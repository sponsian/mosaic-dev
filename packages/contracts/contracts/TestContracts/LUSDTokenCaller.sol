// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IMoUSDToken.sol";

contract MoUSDTokenCaller {
    IMoUSDToken MoUSD;

    function setMoUSD(IMoUSDToken _MoUSD) external {
        MoUSD = _MoUSD;
    }

    function msicMint(address _account, uint _amount) external {
        MoUSD.mint(_account, _amount);
    }

    function msicBurn(address _account, uint _amount) external {
        MoUSD.burn(_account, _amount);
    }

    function msicSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        MoUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function msicReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        MoUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}

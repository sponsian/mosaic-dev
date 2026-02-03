// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IMEURToken.sol";

contract MEURTokenCaller {
    IMEURToken MEUR;

    function setMEUR(IMEURToken _MEUR) external {
        MEUR = _MEUR;
    }

    function msicMint(address _account, uint _amount) external {
        MEUR.mint(_account, _amount);
    }

    function msicBurn(address _account, uint _amount) external {
        MEUR.burn(_account, _amount);
    }

    function msicSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        MEUR.sendToPool(_sender, _poolAddress, _amount);
    }

    function msicReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        MEUR.returnFromPool(_poolAddress, _receiver, _amount);
    }
}

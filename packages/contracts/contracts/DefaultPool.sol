// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IDefaultPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Default Pool holds the REEF and MEUR debt (but not MEUR tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending REEF and MEUR debt, its pending REEF and MEUR debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, CheckContract, IDefaultPool {
    using SafeMath for uint256;

    string constant public NAME = "DefaultPool";

    address public troveManagerAddress;
    address public activePoolAddress;
    uint256 internal REEF;  // deposited REEF tracker
    uint256 internal MEURDebt;  // debt

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolMEURDebtUpdated(uint _MEURDebt);
    event DefaultPoolETHBalanceUpdated(uint _ETH);

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);

        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the REEF state variable.
    *
    * Not necessarily equal to the the contract's raw REEF balance - ether can be forcibly sent to contracts.
    */
    function getETH() external view override returns (uint) {
        return REEF;
    }

    function getMEURDebt() external view override returns (uint) {
        return MEURDebt;
    }

    // --- Pool functionality ---

    function sendETHToActivePool(uint _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD
        REEF = REEF.sub(_amount);
        emit DefaultPoolETHBalanceUpdated(REEF);
        emit EtherSent(activePool, _amount);

        (bool success, ) = activePool.call{ value: _amount }("");
        require(success, "DefaultPool: sending REEF failed");
    }

    function increaseMEURDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        MEURDebt = MEURDebt.add(_amount);
        emit DefaultPoolMEURDebtUpdated(MEURDebt);
    }

    function decreaseMEURDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        MEURDebt = MEURDebt.sub(_amount);
        emit DefaultPoolMEURDebtUpdated(MEURDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        REEF = REEF.add(msg.value);
        emit DefaultPoolETHBalanceUpdated(REEF);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/console.sol";
import "../Interfaces/IMSICToken.sol";
import "../Interfaces/IMSICStaking.sol";
import "../Dependencies/MosaicMath.sol";
import "../Interfaces/IMEURToken.sol";

contract MSICStaking is IMSICStaking, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---
    string constant public NAME = "MSICStaking";

    mapping( address => uint) public stakes;
    uint public totalMSICStaked;

    uint public F_ETH;  // Running sum of REEF fees per-MSIC-staked
    uint public F_MEUR; // Running sum of MSIC fees per-MSIC-staked

    // User snapshots of F_ETH and F_MEUR, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) public snapshots; 

    struct Snapshot {
        uint F_ETH_Snapshot;
        uint F_MEUR_Snapshot;
    }
    
    IMSICToken public msicToken;
    IMEURToken public msicToken;

    address public troveManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

    event MSICTokenAddressSet(address _msicTokenAddress);
    event MEURTokenAddressSet(address _msicTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint MEURGain, uint ETHGain);
    event F_ETHUpdated(uint _F_ETH);
    event F_MEURUpdated(uint _F_MEUR);
    event TotalMSICStakedUpdated(uint _totalMSICStaked);
    event EtherSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_ETH, uint _F_MEUR);

    // --- Functions ---

    function setAddresses
    (
        address _msicTokenAddress,
        address _mousdTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_msicTokenAddress);
        checkContract(_mousdTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        msicToken = IMSICToken(_msicTokenAddress);
        msicToken = IMEURToken(_msicTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit MSICTokenAddressSet(_msicTokenAddress);
        emit MoUSDTokenAddressSet(_mousdTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // If caller has a pre-existing stake, send any accumulated REEF and MEUR gains to them. 
    function stake(uint _MSICamount) external override {
        _requireNonZeroAmount(_MSICamount);

        uint currentStake = stakes[msg.sender];

        uint ETHGain;
        uint MEURGain;
        // Grab any accumulated REEF and MEUR gains from the current stake
        if (currentStake != 0) {
            ETHGain = _getPendingETHGain(msg.sender);
            MEURGain = _getPendingMEURGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        uint newStake = currentStake.add(_MSICamount);

        // Increase user’s stake and total MSIC staked
        stakes[msg.sender] = newStake;
        totalMSICStaked = totalMSICStaked.add(_MSICamount);
        emit TotalMSICStakedUpdated(totalMSICStaked);

        // Transfer MSIC from caller to this contract
        msicToken.sendToMSICStaking(msg.sender, _MSICamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, MEURGain, ETHGain);

         // Send accumulated MEUR and REEF gains to the caller
        if (currentStake != 0) {
            msicToken.transfer(msg.sender, MEURGain);
            _sendETHGainToUser(ETHGain);
        }
    }

    // Unstake the MSIC and send the it back to the caller, along with their accumulated MEUR & REEF gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _MSICamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated REEF and MEUR gains from the current stake
        uint ETHGain = _getPendingETHGain(msg.sender);
        uint MEURGain = _getPendingMEURGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        if (_MSICamount > 0) {
            uint MSICToWithdraw = MosaicMath._min(_MSICamount, currentStake);

            uint newStake = currentStake.sub(MSICToWithdraw);

            // Decrease user's stake and total MSIC staked
            stakes[msg.sender] = newStake;
            totalMSICStaked = totalMSICStaked.sub(MSICToWithdraw);
            emit TotalMSICStakedUpdated(totalMSICStaked);

            // Transfer unstaked MSIC to user
            msicToken.transfer(msg.sender, MSICToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, MEURGain, ETHGain);

        // Send accumulated MEUR and REEF gains to the caller
        msicToken.transfer(msg.sender, MEURGain);
        _sendETHGainToUser(ETHGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Mosaic core contracts ---

    function increaseF_ETH(uint _ETHFee) external override {
        _requireCallerIsTroveManager();
        uint ETHFeePerMSICStaked;
     
        if (totalMSICStaked > 0) {ETHFeePerMSICStaked = _ETHFee.mul(DECIMAL_PRECISION).div(totalMSICStaked);}

        F_ETH = F_ETH.add(ETHFeePerMSICStaked); 
        emit F_ETHUpdated(F_ETH);
    }

    function increaseF_MEUR(uint _MEURFee) external override {
        _requireCallerIsBorrowerOperations();
        uint MEURFeePerMSICStaked;
        
        if (totalMSICStaked > 0) {MEURFeePerMSICStaked = _MEURFee.mul(DECIMAL_PRECISION).div(totalMSICStaked);}
        
        F_MEUR = F_MEUR.add(MEURFeePerMSICStaked);
        emit F_MEURUpdated(F_MEUR);
    }

    // --- Pending reward functions ---

    function getPendingETHGain(address _user) external view override returns (uint) {
        return _getPendingETHGain(_user);
    }

    function _getPendingETHGain(address _user) internal view returns (uint) {
        uint F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
        uint ETHGain = stakes[_user].mul(F_ETH.sub(F_ETH_Snapshot)).div(DECIMAL_PRECISION);
        return ETHGain;
    }

    function getPendingMEURGain(address _user) external view override returns (uint) {
        return _getPendingMEURGain(_user);
    }

    function _getPendingMEURGain(address _user) internal view returns (uint) {
        uint F_MEUR_Snapshot = snapshots[_user].F_MEUR_Snapshot;
        uint MEURGain = stakes[_user].mul(F_MEUR.sub(F_MEUR_Snapshot)).div(DECIMAL_PRECISION);
        return MEURGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_MEUR_Snapshot = F_MEUR;
        emit StakerSnapshotsUpdated(_user, F_ETH, F_MEUR);
    }

    function _sendETHGainToUser(uint ETHGain) internal {
        emit EtherSent(msg.sender, ETHGain);
        (bool success, ) = msg.sender.call{value: ETHGain}("");
        require(success, "MSICStaking: Failed to send accumulated ETHGain");
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "MSICStaking: caller is not TroveM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "MSICStaking: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "MSICStaking: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {  
        require(currentStake > 0, 'MSICStaking: User must have a non-zero stake');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'MSICStaking: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}

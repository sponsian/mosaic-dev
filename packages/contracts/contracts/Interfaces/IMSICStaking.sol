// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IMSICStaking {

    // --- Events --
    
    event MSICTokenAddressSet(address _msicTokenAddress);
    event MEURTokenAddressSet(address _meurTokenAddress);
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
        address _meurTokenAddress,
        address _troveManagerAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint _MSICamount) external;

    function unstake(uint _MSICamount) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_MEUR(uint _MSICFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingMEURGain(address _user) external view returns (uint);
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICommunityIssuance { 
    
    // --- Events ---
    
    event MSICTokenAddressSet(address _msicTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalMSICIssuedUpdated(uint _totalMSICIssued);

    // --- Functions ---

    function setAddresses(address _msicTokenAddress, address _stabilityPoolAddress) external;

    function issueMSIC() external returns (uint);

    function sendMSIC(address _account, uint _MSICamount) external;
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IMSICToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/MosaicMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---

    string constant public NAME = "CommunityIssuance";

    uint constant public SECONDS_IN_ONE_MINUTE = 60;

   /* The issuance factor F determines the curvature of the issuance curve.
    *
    * Minutes in one year: 60*24*365 = 525600
    *
    * For 50% of remaining tokens issued each year, with minutes as time units, we have:
    * 
    * F ** 525600 = 0.5
    * 
    * Re-arranging:
    * 
    * 525600 * ln(F) = ln(0.5)
    * F = 0.5 ** (1/525600)
    * F = 0.999998681227695000 
    */
    uint constant public ISSUANCE_FACTOR = 999998681227695000;

    /* 
    * The community MSIC supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by MSICToken, when the token is deployed.
    * 
    * Set to 32M (slightly less than 1/3) of total MSIC supply.
    */
    uint constant public MSICSupplyCap = 32e24; // 32 million

    IMSICToken public msicToken;

    address public stabilityPoolAddress;

    uint public totalMSICIssued;
    uint public immutable deploymentTime;

    // --- Events ---

    event MSICTokenAddressSet(address _msicTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalMSICIssuedUpdated(uint _totalMSICIssued);

    // --- Functions ---

    constructor() public {
        deploymentTime = block.timestamp;
    }

    function setAddresses
    (
        address _msicTokenAddress, 
        address _stabilityPoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_msicTokenAddress);
        checkContract(_stabilityPoolAddress);

        msicToken = IMSICToken(_msicTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        // When MSICToken deployed, it should have transferred CommunityIssuance's MSIC entitlement
        uint MSICBalance = msicToken.balanceOf(address(this));
        assert(MSICBalance >= MSICSupplyCap);

        emit MSICTokenAddressSet(_msicTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueMSIC() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint latestTotalMSICIssued = MSICSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalMSICIssued.sub(totalMSICIssued);

        totalMSICIssued = latestTotalMSICIssued;
        emit TotalMSICIssuedUpdated(latestTotalMSICIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last MSIC issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint power = MosaicMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint cumulativeIssuanceFraction = (uint(DECIMAL_PRECISION).sub(power));
        assert(cumulativeIssuanceFraction <= DECIMAL_PRECISION); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendMSIC(address _account, uint _MSICamount) external override {
        _requireCallerIsStabilityPool();

        msicToken.transfer(_account, _MSICamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/MosaicMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IMSICStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./MSICStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, MSICStakingScript {
    using SafeMath for uint;

    string constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable msicToken;
    IERC20 immutable msicToken;
    IMSICStaking immutable msicStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _msicStakingAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        MSICStakingScript(_msicStakingAddress)
        public
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = troveManagerCached.priceFeed();
        checkContract(address(priceFeedCached));
        priceFeed = priceFeedCached;

        address msicTokenCached = address(troveManagerCached.msicToken());
        checkContract(msicTokenCached);
        msicToken = IERC20(msicTokenCached);

        address msicTokenCached = address(troveManagerCached.msicToken());
        checkContract(msicTokenCached);
        msicToken = IERC20(msicTokenCached);

        IMSICStaking msicStakingCached = troveManagerCached.msicStaking();
        require(_msicStakingAddress == address(msicStakingCached), "BorrowerWrappersScript: Wrong MSICStaking address");
        msicStaking = msicStakingCached;
    }

    function claimCollateralAndOpenTrove(uint _maxFee, uint _MEURAmount, address _upperHint, address _lowerHint) external payable {
        uint balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);

        // Open trove with obtained collateral, plus collateral sent by user
        borrowerOperations.openTrove{ value: totalCollateral }(_maxFee, _MEURAmount, _upperHint, _lowerHint);
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint msicBalanceBefore = msicToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = address(this).balance;
        uint msicBalanceAfter = msicToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed REEF to trove, get more MEUR and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint MEURAmount = _getNetMEURAmount(claimedCollateral);
            borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, MEURAmount, true, _upperHint, _lowerHint);
            // Provide withdrawn MEUR to Stability Pool
            if (MEURAmount > 0) {
                stabilityPool.provideToSP(MEURAmount, address(0));
            }
        }

        // Stake claimed MSIC
        uint claimedMSIC = msicBalanceAfter.sub(msicBalanceBefore);
        if (claimedMSIC > 0) {
            msicStaking.stake(claimedMSIC);
        }
    }

    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint msicBalanceBefore = msicToken.balanceOf(address(this));
        uint msicBalanceBefore = msicToken.balanceOf(address(this));

        // Claim gains
        msicStaking.unstake(0);

        uint gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedMEUR = msicToken.balanceOf(address(this)).sub(msicBalanceBefore);

        uint netMEURAmount;
        // Top up trove and get more MEUR, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netMEURAmount = _getNetMEURAmount(gainedCollateral);
            borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netMEURAmount, true, _upperHint, _lowerHint);
        }

        uint totalMEUR = gainedMEUR.add(netMEURAmount);
        if (totalMEUR > 0) {
            stabilityPool.provideToSP(totalMEUR, address(0));

            // Providing to Stability Pool also triggers MSIC claim, so stake it if any
            uint msicBalanceAfter = msicToken.balanceOf(address(this));
            uint claimedMSIC = msicBalanceAfter.sub(msicBalanceBefore);
            if (claimedMSIC > 0) {
                msicStaking.stake(claimedMSIC);
            }
        }

    }

    function _getNetMEURAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint MEURAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = MEURAmount.mul(MosaicMath.DECIMAL_PRECISION).div(MosaicMath.DECIMAL_PRECISION.add(borrowingRate));

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}

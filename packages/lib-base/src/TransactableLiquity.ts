import { Decimal, Decimalish } from "./Decimal";
import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";
import { FailedReceipt } from "./SendableMosaic";

/**
 * Thrown by {@link TransactableMosaic} functions in case of transaction failure.
 *
 * @public
 */
export class TransactionFailedError<T extends FailedReceipt = FailedReceipt> extends Error {
  readonly failedReceipt: T;

  /** @internal */
  constructor(name: string, message: string, failedReceipt: T) {
    super(message);
    this.name = name;
    this.failedReceipt = failedReceipt;
  }
}

/**
 * Details of an {@link TransactableMosaic.openTrove | openTrove()} transaction.
 *
 * @public
 */
export interface TroveCreationDetails {
  /** How much was deposited and borrowed. */
  params: TroveCreationParams<Decimal>;

  /** The Trove that was created by the transaction. */
  newTrove: Trove;

  /** Amount of MoUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of an {@link TransactableMosaic.adjustTrove | adjustTrove()} transaction.
 *
 * @public
 */
export interface TroveAdjustmentDetails {
  /** Parameters of the adjustment. */
  params: TroveAdjustmentParams<Decimal>;

  /** New state of the adjusted Trove directly after the transaction. */
  newTrove: Trove;

  /** Amount of MoUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of a {@link TransactableMosaic.closeTrove | closeTrove()} transaction.
 *
 * @public
 */
export interface TroveClosureDetails {
  /** How much was withdrawn and repaid. */
  params: TroveClosureParams<Decimal>;
}

/**
 * Details of a {@link TransactableMosaic.liquidate | liquidate()} or
 * {@link TransactableMosaic.liquidateUpTo | liquidateUpTo()} transaction.
 *
 * @public
 */
export interface LiquidationDetails {
  /** Addresses whose Troves were liquidated by the transaction. */
  liquidatedAddresses: string[];

  /** Total collateral liquidated and debt cleared by the transaction. */
  totalLiquidated: Trove;

  /** Amount of MoUSD paid to the liquidator as gas compensation. */
  msicGasCompensation: Decimal;

  /** Amount of native currency (e.g. Ether) paid to the liquidator as gas compensation. */
  collateralGasCompensation: Decimal;
}

/**
 * Details of a {@link TransactableMosaic.redeemMoUSD | redeemMoUSD()} transaction.
 *
 * @public
 */
export interface RedemptionDetails {
  /** Amount of MoUSD the redeemer tried to redeem. */
  attemptedMoUSDAmount: Decimal;

  /**
   * Amount of MoUSD that was actually redeemed by the transaction.
   *
   * @remarks
   * This can end up being lower than `attemptedMoUSDAmount` due to interference from another
   * transaction that modifies the list of Troves.
   *
   * @public
   */
  actualMoUSDAmount: Decimal;

  /** Amount of collateral (e.g. Ether) taken from Troves by the transaction. */
  collateralTaken: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee from collateral taken. */
  fee: Decimal;
}

/**
 * Details of a
 * {@link TransactableMosaic.withdrawGainsFromStabilityPool | withdrawGainsFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityPoolGainsWithdrawalDetails {
  /** Amount of MoUSD burned from the deposit by liquidations since the last modification. */
  msicLoss: Decimal;

  /** Amount of MoUSD in the deposit directly after this transaction. */
  newMoUSDDeposit: Decimal;

  /** Amount of native currency (e.g. Ether) paid out to the depositor in this transaction. */
  collateralGain: Decimal;

  /** Amount of MSIC rewarded to the depositor in this transaction. */
  msicReward: Decimal;
}

/**
 * Details of a
 * {@link TransactableMosaic.depositMoUSDInStabilityPool | depositMoUSDInStabilityPool()} or
 * {@link TransactableMosaic.withdrawMoUSDFromStabilityPool | withdrawMoUSDFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  /** Change that was made to the deposit by this transaction. */
  change: StabilityDepositChange<Decimal>;
}

/**
 * Details of a
 * {@link TransactableMosaic.transferCollateralGainToTrove | transferCollateralGainToTrove()}
 * transaction.
 *
 * @public
 */
export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  /** New state of the depositor's Trove directly after the transaction. */
  newTrove: Trove;
}

/**
 * Send Mosaic transactions and wait for them to succeed.
 *
 * @remarks
 * The functions return the details of the transaction (if any), or throw an implementation-specific
 * subclass of {@link TransactionFailedError} in case of transaction failure.
 *
 * Implemented by {@link @mosaic/lib-ethers#EthersMosaic}.
 *
 * @public
 */
export interface TransactableMosaic {
  /**
   * Open a new Trove by depositing collateral and borrowing MoUSD.
   *
   * @param params - How much to deposit and borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @mosaic/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveCreationDetails>;

  /**
   * Close existing Trove by repaying all debt and withdrawing all collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  closeTrove(): Promise<TroveClosureDetails>;

  /**
   * Adjust existing Trove by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @mosaic/lib-base#Fees.borrowingRate | borrowing rate} if
   *                           `params` includes `borrowMoUSD`.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The transaction will fail if the Trove's debt would fall below
   * {@link @mosaic/lib-base#MoUSD_MINIMUM_DEBT}.
   *
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Trove's existing collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ depositCollateral: amount })
   * ```
   */
  depositCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by withdrawing some of its collateral.
   *
   * @param amount - The amount of collateral to withdraw from the Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ withdrawCollateral: amount })
   * ```
   */
  withdrawCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by borrowing more MoUSD.
   *
   * @param amount - The amount of MoUSD to borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @mosaic/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ borrowMoUSD: amount }, maxBorrowingRate)
   * ```
   */
  borrowMoUSD(amount: Decimalish, maxBorrowingRate?: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by repaying some of its debt.
   *
   * @param amount - The amount of MoUSD to repay.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ repayMoUSD: amount })
   * ```
   */
  repayMoUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /** @internal */
  setPrice(price: Decimalish): Promise<void>;

  /**
   * Liquidate one or more undercollateralized Troves.
   *
   * @param address - Address or array of addresses whose Troves to liquidate.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidate(address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Troves up to a maximum number.
   *
   * @param maximumNumberOfTrovesToLiquidate - Stop after liquidating this many Troves.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of MoUSD to add to new or existing deposit.
   * @param frontendTag - Address that should receive a share of this deposit's MSIC rewards.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The `frontendTag` parameter is only effective when making a new deposit.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link @mosaic/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#StabilityDeposit.msicReward | MSIC reward}.
   */
  depositMoUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw MoUSD from Stability Deposit.
   *
   * @param amount - Amount of MoUSD to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @mosaic/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#StabilityDeposit.msicReward | MSIC reward}.
   */
  withdrawMoUSDFromStabilityPool(amount: Decimalish): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link @mosaic/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#StabilityDeposit.msicReward | MSIC reward} from Stability Deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link @mosaic/lib-base#StabilityDeposit.collateralGain | collateral gain} from
   * Stability Deposit to Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The collateral gain is transfered to the Trove as additional collateral.
   *
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @mosaic/lib-base#StabilityDeposit.msicReward | MSIC reward}.
   */
  transferCollateralGainToTrove(): Promise<CollateralGainTransferDetails>;

  /**
   * Send MoUSD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of MoUSD to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendMoUSD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Send MSIC tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of MSIC to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendMSIC(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem MoUSD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of MoUSD to be redeemed.
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @mosaic/lib-base#Fees.redemptionRate | redemption rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the current redemption rate (based on `amount`) plus 0.1%
   * is used as maximum acceptable rate.
   */
  redeemMoUSD(amount: Decimalish, maxRedemptionRate?: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link @mosaic/lib-base#ReadableMosaic.getCollateralSurplusBalance | getCollateralSurplusBalance()}
   * to check the amount of collateral available for withdrawal.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(): Promise<void>;

  /**
   * Stake MSIC to start earning fee revenue or increase existing stake.
   *
   * @param amount - Amount of MSIC to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out an existing MSIC stake's
   * {@link @mosaic/lib-base#MSICStake.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#MSICStake.msicGain | MoUSD gain}.
   */
  stakeMSIC(amount: Decimalish): Promise<void>;

  /**
   * Withdraw MSIC from staking.
   *
   * @param amount - Amount of MSIC to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the MSIC stake's
   * {@link @mosaic/lib-base#MSICStake.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#MSICStake.msicGain | MoUSD gain}.
   */
  unstakeMSIC(amount: Decimalish): Promise<void>;

  /**
   * Withdraw {@link @mosaic/lib-base#MSICStake.collateralGain | collateral gain} and
   * {@link @mosaic/lib-base#MSICStake.msicGain | MoUSD gain} from MSIC stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(): Promise<void>;

  /**
   * Allow the liquidity mining contract to use Uniswap ETH/MoUSD LP tokens for
   * {@link @mosaic/lib-base#TransactableMosaic.stakeUniTokens | staking}.
   *
   * @param allowance - Maximum amount of LP tokens that will be transferrable to liquidity mining
   *                    (`2^256 - 1` by default).
   *
   * @remarks
   * Must be performed before calling
   * {@link @mosaic/lib-base#TransactableMosaic.stakeUniTokens | stakeUniTokens()}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  approveUniTokens(allowance?: Decimalish): Promise<void>;

  /**
   * Stake Uniswap ETH/MoUSD LP tokens to participate in liquidity mining and earn MSIC.
   *
   * @param amount - Amount of LP tokens to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  stakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw Uniswap ETH/MoUSD LP tokens from liquidity mining.
   *
   * @param amount - Amount of LP tokens to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  unstakeUniTokens(amount: Decimalish): Promise<void>;

  /**
   * Withdraw MSIC that has been earned by mining liquidity.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawMSICRewardFromLiquidityMining(): Promise<void>;

  /**
   * Withdraw all staked LP tokens from liquidity mining and claim reward.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  exitLiquidityMining(): Promise<void>;

  /**
   * Register current wallet address as a Mosaic frontend.
   *
   * @param kickbackRate - The portion of MSIC rewards to pass onto users of the frontend
   *                       (between 0 and 1).
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  registerFrontend(kickbackRate: Decimalish): Promise<void>;
}

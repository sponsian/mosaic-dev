import { Decimal, Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";
import { MosaicReceipt, SendableMosaic, SentMosaicTransaction } from "./SendableMosaic";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableMosaic";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @mosaic/lib-ethers#PopulatedEthersMosaicTransaction}.
 *
 * @public
 */
export interface PopulatedMosaicTransaction<
  P = unknown,
  T extends SentMosaicTransaction = SentMosaicTransaction
> {
  /** Implementation-specific populated transaction object. */
  readonly rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link @mosaic/lib-base#SentMosaicTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A redemption transaction that has been prepared for sending.
 *
 * @remarks
 * The Mosaic protocol fulfills redemptions by repaying the debt of Troves in ascending order of
 * their collateralization ratio, and taking a portion of their collateral in exchange. Due to the
 * {@link @mosaic/lib-base#MoUSD_MINIMUM_DEBT | minimum debt} requirement that Troves must fulfill,
 * some MoUSD amounts are not possible to redeem exactly.
 *
 * When {@link @mosaic/lib-base#PopulatableMosaic.redeemMoUSD | redeemMoUSD()} is called with an
 * amount that can't be fully redeemed, the amount will be truncated (see the `redeemableMoUSDAmount`
 * property). When this happens, the redeemer can either redeem the truncated amount by sending the
 * transaction unchanged, or prepare a new transaction by
 * {@link @mosaic/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt | increasing the amount}
 * to the next lowest possible value, which is the sum of the truncated amount and
 * {@link @mosaic/lib-base#MoUSD_MINIMUM_NET_DEBT}.
 *
 * @public
 */
export interface PopulatedRedemption<P = unknown, S = unknown, R = unknown>
  extends PopulatedMosaicTransaction<
    P,
    SentMosaicTransaction<S, MosaicReceipt<R, RedemptionDetails>>
  > {
  /** Amount of MoUSD the redeemer is trying to redeem. */
  readonly attemptedMoUSDAmount: Decimal;

  /** Maximum amount of MoUSD that is currently redeemable from `attemptedMoUSDAmount`. */
  readonly redeemableMoUSDAmount: Decimal;

  /** Whether `redeemableMoUSDAmount` is less than `attemptedMoUSDAmount`. */
  readonly isTruncated: boolean;

  /**
   * Prepare a new transaction by increasing the attempted amount to the next lowest redeemable
   * value.
   *
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @mosaic/lib-base#Fees.redemptionRate | redemption rate} to
   *                            use in the new transaction.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the original transaction's `maxRedemptionRate` is reused
   * unless that was also omitted, in which case the current redemption rate (based on the increased
   * amount) plus 0.1% is used as maximum acceptable rate.
   */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;
}

/** @internal */
export type _PopulatableFrom<T, P> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer U>
    ? U extends SentMosaicTransaction
      ? (...args: A) => Promise<PopulatedMosaicTransaction<P, U>>
      : never
    : never;
};

/**
 * Prepare Mosaic transactions for sending.
 *
 * @remarks
 * The functions return an object implementing {@link PopulatedMosaicTransaction}, which can be
 * used to send the transaction and get a {@link SentMosaicTransaction}.
 *
 * Implemented by {@link @mosaic/lib-ethers#PopulatableEthersMosaic}.
 *
 * @public
 */
export interface PopulatableMosaic<R = unknown, S = unknown, P = unknown>
  extends _PopulatableFrom<SendableMosaic<R, S>, P> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableMosaic.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveCreationDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.closeTrove} */
  closeTrove(): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, TroveClosureDetails>>>
  >;

  /** {@inheritDoc TransactableMosaic.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.borrowMoUSD} */
  borrowMoUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.repayMoUSD} */
  repayMoUSD(
    amount: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** @internal */
  setPrice(
    price: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableMosaic.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableMosaic.depositMoUSDInStabilityPool} */
  depositMoUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.withdrawMoUSDFromStabilityPool} */
  withdrawMoUSDFromStabilityPool(
    amount: Decimalish
  ): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, StabilityPoolGainsWithdrawalDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    PopulatedMosaicTransaction<
      P,
      SentMosaicTransaction<S, MosaicReceipt<R, CollateralGainTransferDetails>>
    >
  >;

  /** {@inheritDoc TransactableMosaic.sendMoUSD} */
  sendMoUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.sendMSIC} */
  sendMSIC(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.redeemMoUSD} */
  redeemMoUSD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;

  /** {@inheritDoc TransactableMosaic.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMosaic.stakeMSIC} */
  stakeMSIC(
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.unstakeMSIC} */
  unstakeMSIC(
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMosaic.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;

  /** {@inheritDoc TransactableMosaic.withdrawMSICRewardFromLiquidityMining} */
  withdrawMSICRewardFromLiquidityMining(): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMosaic.exitLiquidityMining} */
  exitLiquidityMining(): Promise<
    PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableMosaic.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<PopulatedMosaicTransaction<P, SentMosaicTransaction<S, MosaicReceipt<R, void>>>>;
}

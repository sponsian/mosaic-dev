import { Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableMosaic,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableMosaic";

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @mosaic/lib-ethers#SentEthersMosaicTransaction}.
 *
 * @public
 */
export interface SentMosaicTransaction<S = unknown, T extends MosaicReceipt = MosaicReceipt> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @mosaic/lib-base#SentMosaicTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @mosaic/lib-base#FailedReceipt} or a
   *          {@link @mosaic/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentMosaicTransaction.getReceipt}.
 *
 * @public
 */
export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

/**
 * Indicates that the transaction has been mined, but it failed.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * Returned by {@link SentMosaicTransaction.getReceipt} and
 * {@link SentMosaicTransaction.waitForReceipt}.
 *
 * @public
 */
export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

/**
 * Indicates that the transaction has succeeded.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * The `details` property may contain more information about the transaction.
 * See the return types of {@link TransactableMosaic} functions for the exact contents of `details`
 * for each type of Mosaic transaction.
 *
 * Returned by {@link SentMosaicTransaction.getReceipt} and
 * {@link SentMosaicTransaction.waitForReceipt}.
 *
 * @public
 */
export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

/** @internal */
export const _successfulReceipt = <R, D>(
  rawReceipt: R,
  details: D,
  toString?: () => string
): SuccessfulReceipt<R, D> => ({
  status: "succeeded",
  rawReceipt,
  details,
  ...(toString ? { toString } : {})
});

/**
 * Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;

/**
 * One of either a {@link PendingReceipt}, a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MosaicReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

/** @internal */
export type _SendableFrom<T, R, S> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? (...args: A) => Promise<SentMosaicTransaction<S, MosaicReceipt<R, D>>>
    : never;
};

/**
 * Send Mosaic transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentMosaicTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @mosaic/lib-ethers#SendableEthersMosaic}.
 *
 * @public
 */
export interface SendableMosaic<R = unknown, S = unknown>
  extends _SendableFrom<TransactableMosaic, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableMosaic.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveCreationDetails>>>;

  /** {@inheritDoc TransactableMosaic.closeTrove} */
  closeTrove(): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveClosureDetails>>>;

  /** {@inheritDoc TransactableMosaic.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableMosaic.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableMosaic.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableMosaic.borrowMEUR} */
  borrowMEUR(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableMosaic.repayMEUR} */
  repayMEUR(
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, TroveAdjustmentDetails>>>;

  /** @internal */
  setPrice(price: Decimalish): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableMosaic.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableMosaic.depositMEURInStabilityPool} */
  depositMEURInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableMosaic.withdrawMEURFromStabilityPool} */
  withdrawMEURFromStabilityPool(
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableMosaic.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    SentMosaicTransaction<S, MosaicReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableMosaic.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    SentMosaicTransaction<S, MosaicReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableMosaic.sendMEUR} */
  sendMEUR(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.sendMSIC} */
  sendMSIC(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.redeemMEUR} */
  redeemMEUR(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableMosaic.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.stakeMSIC} */
  stakeMSIC(amount: Decimalish): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.unstakeMSIC} */
  unstakeMSIC(amount: Decimalish): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.stakeUniTokens} */
  stakeUniTokens(amount: Decimalish): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.unstakeUniTokens} */
  unstakeUniTokens(amount: Decimalish): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.withdrawMSICRewardFromLiquidityMining} */
  withdrawMSICRewardFromLiquidityMining(): Promise<
    SentMosaicTransaction<S, MosaicReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableMosaic.exitLiquidityMining} */
  exitLiquidityMining(): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;

  /** {@inheritDoc TransactableMosaic.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<SentMosaicTransaction<S, MosaicReceipt<R, void>>>;
}

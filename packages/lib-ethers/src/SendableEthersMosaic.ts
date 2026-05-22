import {
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableMosaic,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams
} from "@mosaic/lib-base";

import {
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersMosaic,
  PopulatedEthersMosaicTransaction,
  SentEthersMosaicTransaction
} from "./PopulatableEthersMosaic";

const sendTransaction = <T>(tx: PopulatedEthersMosaicTransaction<T>) => tx.send();

/**
 * Ethers-based implementation of {@link @mosaic/lib-base#SendableMosaic}.
 *
 * @public
 */
export class SendableEthersMosaic
  implements SendableMosaic<EthersTransactionReceipt, EthersTransactionResponse> {
  private _populate: PopulatableEthersMosaic;

  constructor(populatable: PopulatableEthersMosaic) {
    this._populate = populatable;
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.closeTrove} */
  closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.borrowMEUR} */
  borrowMEUR(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowMEUR(amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.repayMEUR} */
  repayMEUR(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayMEUR(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.depositMEURInStabilityPool} */
  depositMEURInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositMEURInStabilityPool(amount, frontendTag, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.withdrawMEURFromStabilityPool} */
  withdrawMEURFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawMEURFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.sendMEUR} */
  sendMEUR(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.sendMEUR(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.sendMSIC} */
  sendMSIC(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.sendMSIC(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.redeemMEUR} */
  redeemMEUR(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<RedemptionDetails>> {
    return this._populate.redeemMEUR(amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.stakeMSIC} */
  stakeMSIC(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.stakeMSIC(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.unstakeMSIC} */
  unstakeMSIC(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.unstakeMSIC(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.withdrawGainsFromStaking(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.registerFrontend(kickbackRate, overrides).then(sendTransaction);
  }

  /** @internal */
  _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate._mintUniToken(amount, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.approveUniTokens(allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.stakeUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.unstakeUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.withdrawMSICRewardFromLiquidityMining} */
  withdrawMSICRewardFromLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.withdrawMSICRewardFromLiquidityMining(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @mosaic/lib-base#SendableMosaic.exitLiquidityMining} */
  exitLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersMosaicTransaction<void>> {
    return this._populate.exitLiquidityMining(overrides).then(sendTransaction);
  }
}

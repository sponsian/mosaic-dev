import assert from "assert";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Log } from "@ethersproject/abstract-provider";
import { ErrorCode } from "@ethersproject/logger";
import { Transaction } from "@ethersproject/transactions";

import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  LiquidationDetails,
  MosaicReceipt,
  MoUSD_MINIMUM_DEBT,
  MoUSD_MINIMUM_NET_DEBT,
  MinedReceipt,
  PopulatableMosaic,
  PopulatedMosaicTransaction,
  PopulatedRedemption,
  RedemptionDetails,
  SentMosaicTransaction,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  Trove,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams,
  TroveWithPendingRedistribution,
  _failedReceipt,
  _normalizeTroveAdjustment,
  _normalizeTroveCreation,
  _pendingReceipt,
  _successfulReceipt
} from "@liquity/lib-base";

import {
  EthersPopulatedTransaction,
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  EthersMosaicConnection,
  _getContracts,
  _requireAddress,
  _requireSigner
} from "./EthersMosaicConnection";

import { decimalify, promiseAllValues } from "./_utils";
import { _priceFeedIsTestnet, _uniTokenIsMock } from "./contracts";
import { logsToString } from "./parseLogs";
import { ReadableEthersMosaic } from "./ReadableEthersMosaic";

const bigNumberMax = (a: BigNumber, b?: BigNumber) => (b?.gt(a) ? b : a);

// With 70 iterations redemption costs about ~10M gas, and each iteration accounts for ~138k more
/** @internal */
export const _redeemMaxIterations = 70;

const defaultBorrowingRateSlippageTolerance = Decimal.from(0.005); // 0.5%
const defaultRedemptionRateSlippageTolerance = Decimal.from(0.001); // 0.1%
const defaultBorrowingFeeDecayToleranceMinutes = 10;

const noDetails = () => undefined;

const compose = <T, U, V>(f: (_: U) => V, g: (_: T) => U) => (_: T) => f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K (use 10K to be safe) to update lastFeeOperationTime, but the cost of calculating the
// decayed baseRate increases logarithmically with time elapsed since the last update.
const addGasForBaseRateUpdate = (maxMinutesSinceLastUpdate = 10) => (gas: BigNumber) =>
  gas.add(10000 + 1414 * Math.ceil(Math.log2(maxMinutesSinceLastUpdate + 1)));

// First traversal in ascending direction takes ~50K, then ~13.5K per extra step.
// 80K should be enough for 3 steps, plus some extra to be safe.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(80000);

const addGasForMSICIssuance = (gas: BigNumber) => gas.add(50000);

const addGasForUnipoolRewardUpdate = (gas: BigNumber) => gas.add(20000);

// To get the best entropy available, we'd do something like:
//
// const bigRandomNumber = () =>
//   BigNumber.from(
//     `0x${Array.from(crypto.getRandomValues(new Uint32Array(8)))
//       .map(u32 => u32.toString(16).padStart(8, "0"))
//       .join("")}`
//   );
//
// However, Window.crypto is browser-specific. Since we only use this for randomly picking Troves
// during the search for hints, Math.random() will do fine, too.
//
// This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
// required to get a statistically "good" hint is larger than this, the search for the hint will
// be broken up into multiple getApproxHint() calls.
//
// This should be low enough to work with popular public Ethereum providers like Infura without
// triggering any fair use limits.
const maxNumberOfTrialsAtOnce = 2500;

function* generateTrials(totalNumberOfTrials: number) {
  assert(Number.isInteger(totalNumberOfTrials) && totalNumberOfTrials > 0);

  while (totalNumberOfTrials) {
    const numberOfTrials = Math.min(totalNumberOfTrials, maxNumberOfTrialsAtOnce);
    yield numberOfTrials;

    totalNumberOfTrials -= numberOfTrials;
  }
}

/** @internal */
export enum _RawErrorReason {
  TRANSACTION_FAILED = "transaction failed",
  TRANSACTION_CANCELLED = "cancelled",
  TRANSACTION_REPLACED = "replaced",
  TRANSACTION_REPRICED = "repriced"
}

const transactionReplacementReasons: unknown[] = [
  _RawErrorReason.TRANSACTION_CANCELLED,
  _RawErrorReason.TRANSACTION_REPLACED,
  _RawErrorReason.TRANSACTION_REPRICED
];

interface RawTransactionFailedError extends Error {
  code: ErrorCode.CALL_EXCEPTION;
  reason: _RawErrorReason.TRANSACTION_FAILED;
  transactionHash: string;
  transaction: Transaction;
  receipt: EthersTransactionReceipt;
}

/** @internal */
export interface _RawTransactionReplacedError extends Error {
  code: ErrorCode.TRANSACTION_REPLACED;
  reason:
    | _RawErrorReason.TRANSACTION_CANCELLED
    | _RawErrorReason.TRANSACTION_REPLACED
    | _RawErrorReason.TRANSACTION_REPRICED;
  cancelled: boolean;
  hash: string;
  replacement: EthersTransactionResponse;
  receipt: EthersTransactionReceipt;
}

const hasProp = <T, P extends string>(o: T, p: P): o is T & { [_ in P]: unknown } => p in o;

const isTransactionFailedError = (error: Error): error is RawTransactionFailedError =>
  hasProp(error, "code") &&
  error.code === ErrorCode.CALL_EXCEPTION &&
  hasProp(error, "reason") &&
  error.reason === _RawErrorReason.TRANSACTION_FAILED;

const isTransactionReplacedError = (error: Error): error is _RawTransactionReplacedError =>
  hasProp(error, "code") &&
  error.code === ErrorCode.TRANSACTION_REPLACED &&
  hasProp(error, "reason") &&
  transactionReplacementReasons.includes(error.reason);

/**
 * Thrown when a transaction is cancelled or replaced by a different transaction.
 *
 * @public
 */
export class EthersTransactionCancelledError extends Error {
  readonly rawReplacementReceipt: EthersTransactionReceipt;
  readonly rawError: Error;

  /** @internal */
  constructor(rawError: _RawTransactionReplacedError) {
    assert(rawError.reason !== _RawErrorReason.TRANSACTION_REPRICED);

    super(`Transaction ${rawError.reason}`);
    this.name = "TransactionCancelledError";
    this.rawReplacementReceipt = rawError.receipt;
    this.rawError = rawError;
  }
}

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Returned by {@link SendableEthersMosaic} functions.
 *
 * @public
 */
export class SentEthersMosaicTransaction<T = unknown>
  implements
    SentMosaicTransaction<EthersTransactionResponse, MosaicReceipt<EthersTransactionReceipt, T>> {
  /** Ethers' representation of a sent transaction. */
  readonly rawSentTransaction: EthersTransactionResponse;

  private readonly _connection: EthersMosaicConnection;
  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawSentTransaction: EthersTransactionResponse,
    connection: EthersMosaicConnection,
    parse: (rawReceipt: EthersTransactionReceipt) => T
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this._connection = connection;
    this._parse = parse;
  }

  private _receiptFrom(rawReceipt: EthersTransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? _successfulReceipt(rawReceipt, this._parse(rawReceipt), () =>
            logsToString(rawReceipt, _getContracts(this._connection))
          )
        : _failedReceipt(rawReceipt)
      : _pendingReceipt;
  }

  private async _waitForRawReceipt(confirmations?: number) {
    try {
      return await this.rawSentTransaction.wait(confirmations);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (isTransactionFailedError(error)) {
          return error.receipt;
        }

        if (isTransactionReplacedError(error)) {
          if (error.cancelled) {
            throw new EthersTransactionCancelledError(error);
          } else {
            return error.receipt;
          }
        }
      }

      throw error;
    }
  }

  /** {@inheritDoc @liquity/lib-base#SentMosaicTransaction.getReceipt} */
  async getReceipt(): Promise<MosaicReceipt<EthersTransactionReceipt, T>> {
    return this._receiptFrom(await this._waitForRawReceipt(0));
  }

  /**
   * {@inheritDoc @liquity/lib-base#SentMosaicTransaction.waitForReceipt}
   *
   * @throws
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  async waitForReceipt(): Promise<MinedReceipt<EthersTransactionReceipt, T>> {
    const receipt = this._receiptFrom(await this._waitForRawReceipt());

    assert(receipt.status !== "pending");
    return receipt;
  }
}

/**
 * Optional parameters of a transaction that borrows MoUSD.
 *
 * @public
 */
export interface BorrowingOperationOptionalParams {
  /**
   * Maximum acceptable {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate}
   * (default: current borrowing rate plus 0.5%).
   */
  maxBorrowingRate?: Decimalish;

  /**
   * Control the amount of extra gas included attached to the transaction.
   *
   * @remarks
   * Transactions that borrow MoUSD must pay a variable borrowing fee, which is added to the Trove's
   * debt. This fee increases whenever a redemption occurs, and otherwise decays exponentially.
   * Due to this decay, a Trove's collateral ratio can end up being higher than initially calculated
   * if the transaction is pending for a long time. When this happens, the backend has to iterate
   * over the sorted list of Troves to find a new position for the Trove, which costs extra gas.
   *
   * The SDK can estimate how much the gas costs of the transaction may increase due to this decay,
   * and can include additional gas to ensure that it will still succeed, even if it ends up pending
   * for a relatively long time. This parameter specifies the length of time that should be covered
   * by the extra gas.
   *
   * Default: 10 minutes.
   */
  borrowingFeeDecayToleranceMinutes?: number;
}

const normalizeBorrowingOperationOptionalParams = (
  maxBorrowingRateOrOptionalParams: Decimalish | BorrowingOperationOptionalParams | undefined,
  currentBorrowingRate: Decimal | undefined
): {
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
} => {
  if (maxBorrowingRateOrOptionalParams === undefined) {
    return {
      maxBorrowingRate:
        currentBorrowingRate?.add(defaultBorrowingRateSlippageTolerance) ?? Decimal.ZERO,
      borrowingFeeDecayToleranceMinutes: defaultBorrowingFeeDecayToleranceMinutes
    };
  } else if (
    typeof maxBorrowingRateOrOptionalParams === "number" ||
    typeof maxBorrowingRateOrOptionalParams === "string" ||
    maxBorrowingRateOrOptionalParams instanceof Decimal
  ) {
    return {
      maxBorrowingRate: Decimal.from(maxBorrowingRateOrOptionalParams),
      borrowingFeeDecayToleranceMinutes: defaultBorrowingFeeDecayToleranceMinutes
    };
  } else {
    const { maxBorrowingRate, borrowingFeeDecayToleranceMinutes } = maxBorrowingRateOrOptionalParams;

    return {
      maxBorrowingRate:
        maxBorrowingRate !== undefined
          ? Decimal.from(maxBorrowingRate)
          : currentBorrowingRate?.add(defaultBorrowingRateSlippageTolerance) ?? Decimal.ZERO,

      borrowingFeeDecayToleranceMinutes:
        borrowingFeeDecayToleranceMinutes ?? defaultBorrowingFeeDecayToleranceMinutes
    };
  }
};

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Returned by {@link PopulatableEthersMosaic} functions.
 *
 * @public
 */
export class PopulatedEthersMosaicTransaction<T = unknown>
  implements
    PopulatedMosaicTransaction<EthersPopulatedTransaction, SentEthersMosaicTransaction<T>> {
  /** Unsigned transaction object populated by Ethers. */
  readonly rawPopulatedTransaction: EthersPopulatedTransaction;

  /**
   * Extra gas added to the transaction's `gasLimit` on top of the estimated minimum requirement.
   *
   * @remarks
   * Gas estimation is based on blockchain state at the latest block. However, most transactions
   * stay in pending state for several blocks before being included in a block. This may increase
   * the actual gas requirements of certain Mosaic transactions by the time they are eventually
   * mined, therefore the Mosaic SDK increases these transactions' `gasLimit` by default (unless
   * `gasLimit` is {@link EthersTransactionOverrides | overridden}).
   *
   * Note: even though the SDK includes gas headroom for many transaction types, currently this
   * property is only implemented for {@link PopulatableEthersMosaic.openTrove | openTrove()},
   * {@link PopulatableEthersMosaic.adjustTrove | adjustTrove()} and its aliases.
   */
  readonly gasHeadroom?: number;

  private readonly _connection: EthersMosaicConnection;
  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;

  /** @internal */
  constructor(
    rawPopulatedTransaction: EthersPopulatedTransaction,
    connection: EthersMosaicConnection,
    parse: (rawReceipt: EthersTransactionReceipt) => T,
    gasHeadroom?: number
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this._connection = connection;
    this._parse = parse;

    if (gasHeadroom !== undefined) {
      this.gasHeadroom = gasHeadroom;
    }
  }

  /** {@inheritDoc @liquity/lib-base#PopulatedMosaicTransaction.send} */
  async send(): Promise<SentEthersMosaicTransaction<T>> {
    return new SentEthersMosaicTransaction(
      await _requireSigner(this._connection).sendTransaction(this.rawPopulatedTransaction),
      this._connection,
      this._parse
    );
  }
}

/**
 * {@inheritDoc @liquity/lib-base#PopulatedRedemption}
 *
 * @public
 */
export class PopulatedEthersRedemption
  extends PopulatedEthersMosaicTransaction<RedemptionDetails>
  implements
    PopulatedRedemption<
      EthersPopulatedTransaction,
      EthersTransactionResponse,
      EthersTransactionReceipt
    > {
  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.attemptedMoUSDAmount} */
  readonly attemptedMoUSDAmount: Decimal;

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.redeemableMoUSDAmount} */
  readonly redeemableMoUSDAmount: Decimal;

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.isTruncated} */
  readonly isTruncated: boolean;

  private readonly _increaseAmountByMinimumNetDebt?: (
    maxRedemptionRate?: Decimalish
  ) => Promise<PopulatedEthersRedemption>;

  /** @internal */
  constructor(
    rawPopulatedTransaction: EthersPopulatedTransaction,
    connection: EthersMosaicConnection,
    attemptedMoUSDAmount: Decimal,
    redeemableMoUSDAmount: Decimal,
    increaseAmountByMinimumNetDebt?: (
      maxRedemptionRate?: Decimalish
    ) => Promise<PopulatedEthersRedemption>
  ) {
    const { troveManager } = _getContracts(connection);

    super(
      rawPopulatedTransaction,
      connection,

      ({ logs }) =>
        troveManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _ETHSent, _ETHFee, _actualMoUSDAmount, _attemptedMoUSDAmount } }) => ({
            attemptedMoUSDAmount: decimalify(_attemptedMoUSDAmount),
            actualMoUSDAmount: decimalify(_actualMoUSDAmount),
            collateralTaken: decimalify(_ETHSent),
            fee: decimalify(_ETHFee)
          }))[0]
    );

    this.attemptedMoUSDAmount = attemptedMoUSDAmount;
    this.redeemableMoUSDAmount = redeemableMoUSDAmount;
    this.isTruncated = redeemableMoUSDAmount.lt(attemptedMoUSDAmount);
    this._increaseAmountByMinimumNetDebt = increaseAmountByMinimumNetDebt;
  }

  /** {@inheritDoc @liquity/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt} */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedEthersRedemption> {
    if (!this._increaseAmountByMinimumNetDebt) {
      throw new Error(
        "PopulatedEthersRedemption: increaseAmountByMinimumNetDebt() can " +
          "only be called when amount is truncated"
      );
    }

    return this._increaseAmountByMinimumNetDebt(maxRedemptionRate);
  }
}

/** @internal */
export interface _TroveChangeWithFees<T> {
  params: T;
  newTrove: Trove;
  fee: Decimal;
}

/**
 * Ethers-based implementation of {@link @liquity/lib-base#PopulatableMosaic}.
 *
 * @public
 */
export class PopulatableEthersMosaic
  implements
    PopulatableMosaic<
      EthersTransactionReceipt,
      EthersTransactionResponse,
      EthersPopulatedTransaction
    > {
  private readonly _readable: ReadableEthersMosaic;

  constructor(readable: ReadableEthersMosaic) {
    this._readable = readable;
  }

  private _wrapSimpleTransaction(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersMosaicTransaction<void> {
    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      noDetails
    );
  }

  private _wrapTroveChangeWithFees<T>(
    params: T,
    rawPopulatedTransaction: EthersPopulatedTransaction,
    gasHeadroom?: number
  ): PopulatedEthersMosaicTransaction<_TroveChangeWithFees<T>> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newTrove] = borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(decimalify(_coll), decimalify(_debt)));

        const [fee] = borrowerOperations
          .extractEvents(logs, "MoUSDBorrowingFeePaid")
          .map(({ args: { _MoUSDFee } }) => decimalify(_MoUSDFee));

        return {
          params,
          newTrove,
          fee
        };
      },

      gasHeadroom
    );
  }

  private async _wrapTroveClosure(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): Promise<PopulatedEthersMosaicTransaction<TroveClosureDetails>> {
    const { activePool, msicToken } = _getContracts(this._readable.connection);

    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const [repayMoUSD] = msicToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => decimalify(value));

        const [withdrawCollateral] = activePool
          .extractEvents(logs, "EtherSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => decimalify(_amount));

        return {
          params: repayMoUSD.nonZero ? { withdrawCollateral, repayMoUSD } : { withdrawCollateral }
        };
      }
    );
  }

  private _wrapLiquidation(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersMosaicTransaction<LiquidationDetails> {
    const { troveManager } = _getContracts(this._readable.connection);

    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const liquidatedAddresses = troveManager
          .extractEvents(logs, "TroveLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _MoUSDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: decimalify(_collGasCompensation),
              msicGasCompensation: decimalify(_MoUSDGasCompensation),
              totalLiquidated: new Trove(decimalify(_liquidatedColl), decimalify(_liquidatedDebt))
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      }
    );
  }

  private _extractStabilityPoolGainsWithdrawalDetails(
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    const { stabilityPool } = _getContracts(this._readable.connection);

    const [newMoUSDDeposit] = stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => decimalify(_newDeposit));

    const [[collateralGain, msicLoss]] = stabilityPool
      .extractEvents(logs, "ETHGainWithdrawn")
      .map(({ args: { _ETH, _MoUSDLoss } }) => [decimalify(_ETH), decimalify(_MoUSDLoss)]);

    const [msicReward] = stabilityPool
      .extractEvents(logs, "MSICPaidToDepositor")
      .map(({ args: { _MSIC } }) => decimalify(_MSIC));

    return {
      msicLoss,
      newMoUSDDeposit,
      collateralGain,
      msicReward
    };
  }

  private _wrapStabilityPoolGainsWithdrawal(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersMosaicTransaction<StabilityPoolGainsWithdrawalDetails> {
    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,
      ({ logs }) => this._extractStabilityPoolGainsWithdrawalDetails(logs)
    );
  }

  private _wrapStabilityDepositTopup(
    change: { depositMoUSD: Decimal },
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersMosaicTransaction<StabilityDepositChangeDetails> {
    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => ({
        ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
        change
      })
    );
  }

  private async _wrapStabilityDepositWithdrawal(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): Promise<PopulatedEthersMosaicTransaction<StabilityDepositChangeDetails>> {
    const { stabilityPool, msicToken } = _getContracts(this._readable.connection);

    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs, from: userAddress }) => {
        const gainsWithdrawalDetails = this._extractStabilityPoolGainsWithdrawalDetails(logs);

        const [withdrawMoUSD] = msicToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === stabilityPool.address && to === userAddress)
          .map(({ args: { value } }) => decimalify(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawMoUSD, withdrawAllMoUSD: gainsWithdrawalDetails.newMoUSDDeposit.isZero }
        };
      }
    );
  }

  private _wrapCollateralGainTransfer(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ): PopulatedEthersMosaicTransaction<CollateralGainTransferDetails> {
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return new PopulatedEthersMosaicTransaction(
      rawPopulatedTransaction,
      this._readable.connection,

      ({ logs }) => {
        const [newTrove] = borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(decimalify(_coll), decimalify(_debt)));

        return {
          ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
          newTrove
        };
      }
    );
  }

  private _prepareOverrides(overrides?: EthersTransactionOverrides): EthersTransactionOverrides {
    return { ...overrides, from: _requireAddress(this._readable.connection, overrides) };
  }

  private async _findHintsForNominalCollateralRatio(
    nominalCollateralRatio: Decimal,
    ownAddress?: string
  ): Promise<[string, string]> {
    const { sortedTroves, hintHelpers } = _getContracts(this._readable.connection);
    const numberOfTroves = await this._readable.getNumberOfTroves();

    if (!numberOfTroves) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await sortedTroves.getFirst()];
    }

    const totalNumberOfTrials = Math.ceil(10 * Math.sqrt(numberOfTroves));
    const [firstTrials, ...restOfTrials] = generateTrials(totalNumberOfTrials);

    const collectApproxHint = (
      {
        latestRandomSeed,
        results
      }: {
        latestRandomSeed: BigNumberish;
        results: { diff: BigNumber; hintAddress: string }[];
      },
      numberOfTrials: number
    ) =>
      hintHelpers
        .getApproxHint(nominalCollateralRatio.hex, numberOfTrials, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    let [prev, next] = await sortedTroves.findInsertPosition(
      nominalCollateralRatio.hex,
      hintAddress,
      hintAddress
    );

    if (ownAddress) {
      // In the case of reinsertion, the address of the Trove being reinserted is not a usable hint,
      // because it is deleted from the list before the reinsertion.
      // "Jump over" the Trove to get the proper hint.
      if (prev === ownAddress) {
        prev = await sortedTroves.getPrev(prev);
      } else if (next === ownAddress) {
        next = await sortedTroves.getNext(next);
      }
    }

    // Don't use `address(0)` as hint as it can result in huge gas cost.
    // (See https://github.com/mosaic/dev/issues/600).
    if (prev === AddressZero) {
      prev = next;
    } else if (next === AddressZero) {
      next = prev;
    }

    return [prev, next];
  }

  private async _findHints(trove: Trove, ownAddress?: string): Promise<[string, string]> {
    if (trove instanceof TroveWithPendingRedistribution) {
      throw new Error("Rewards must be applied to this Trove");
    }

    return this._findHintsForNominalCollateralRatio(trove._nominalCollateralRatio, ownAddress);
  }

  private async _findRedemptionHints(
    amount: Decimal
  ): Promise<
    [
      truncatedAmount: Decimal,
      firstRedemptionHint: string,
      partialRedemptionUpperHint: string,
      partialRedemptionLowerHint: string,
      partialRedemptionHintNICR: BigNumber
    ]
  > {
    const { hintHelpers } = _getContracts(this._readable.connection);
    const price = await this._readable.getPrice();

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR,
      truncatedMoUSDamount
    } = await hintHelpers.getRedemptionHints(amount.hex, price.hex, _redeemMaxIterations);

    const [
      partialRedemptionUpperHint,
      partialRedemptionLowerHint
    ] = partialRedemptionHintNICR.isZero()
      ? [AddressZero, AddressZero]
      : await this._findHintsForNominalCollateralRatio(
          decimalify(partialRedemptionHintNICR)
          // XXX: if we knew the partially redeemed Trove's address, we'd pass it here
        );

    return [
      decimalify(truncatedMoUSDamount),
      firstRedemptionHint,
      partialRedemptionUpperHint,
      partialRedemptionLowerHint,
      partialRedemptionHintNICR
    ];
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveCreationDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalizedParams = _normalizeTroveCreation(params);
    const { depositCollateral, borrowMoUSD } = normalizedParams;

    const [fees, blockTimestamp, total, price] = await Promise.all([
      this._readable._getFeesFactory(),
      this._readable._getBlockTimestamp(),
      this._readable.getTotal(),
      this._readable.getPrice()
    ]);

    const recoveryMode = total.collateralRatioIsBelowCritical(price);

    const decayBorrowingRate = (seconds: number) =>
      fees(blockTimestamp + seconds, recoveryMode).borrowingRate();

    const currentBorrowingRate = decayBorrowingRate(0);
    const newTrove = Trove.create(normalizedParams, currentBorrowingRate);
    const hints = await this._findHints(newTrove);

    const {
      maxBorrowingRate,
      borrowingFeeDecayToleranceMinutes
    } = normalizeBorrowingOperationOptionalParams(
      maxBorrowingRateOrOptionalParams,
      currentBorrowingRate
    );

    const txParams = (borrowMoUSD: Decimal): Parameters<typeof borrowerOperations.openTrove> => [
      maxBorrowingRate.hex,
      borrowMoUSD.hex,
      ...hints,
      { value: depositCollateral.hex, ...overrides }
    ];

    let gasHeadroom: number | undefined;

    if (overrides?.gasLimit === undefined) {
      const decayedBorrowingRate = decayBorrowingRate(60 * borrowingFeeDecayToleranceMinutes);
      const decayedTrove = Trove.create(normalizedParams, decayedBorrowingRate);
      const { borrowMoUSD: borrowMoUSDSimulatingDecay } = Trove.recreate(
        decayedTrove,
        currentBorrowingRate
      );

      if (decayedTrove.debt.lt(MoUSD_MINIMUM_DEBT)) {
        throw new Error(
          `Trove's debt might fall below ${MoUSD_MINIMUM_DEBT} ` +
            `within ${borrowingFeeDecayToleranceMinutes} minutes`
        );
      }

      const [gasNow, gasLater] = await Promise.all([
        borrowerOperations.estimateGas.openTrove(...txParams(borrowMoUSD)),
        borrowerOperations.estimateGas.openTrove(...txParams(borrowMoUSDSimulatingDecay))
      ]);

      const gasLimit = addGasForBaseRateUpdate(borrowingFeeDecayToleranceMinutes)(
        bigNumberMax(addGasForPotentialListTraversal(gasNow), gasLater)
      );

      gasHeadroom = gasLimit.sub(gasNow).toNumber();
      overrides = { ...overrides, gasLimit };
    }

    return this._wrapTroveChangeWithFees(
      normalizedParams,
      await borrowerOperations.populateTransaction.openTrove(...txParams(borrowMoUSD)),
      gasHeadroom
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.closeTrove} */
  async closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveClosureDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapTroveClosure(
      await borrowerOperations.estimateAndPopulate.closeTrove(overrides, id)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ depositCollateral: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ withdrawCollateral: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.borrowMoUSD} */
  borrowMoUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ borrowMoUSD: amount }, maxBorrowingRate, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.repayMoUSD} */
  repayMoUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ repayMoUSD: amount }, undefined, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.adjustTrove} */
  async adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<TroveAdjustmentDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    const normalizedParams = _normalizeTroveAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowMoUSD, repayMoUSD } = normalizedParams;

    const [trove, feeVars] = await Promise.all([
      this._readable.getTrove(overrides.from),
      borrowMoUSD &&
        promiseAllValues({
          fees: this._readable._getFeesFactory(),
          blockTimestamp: this._readable._getBlockTimestamp(),
          total: this._readable.getTotal(),
          price: this._readable.getPrice()
        })
    ]);

    const decayBorrowingRate = (seconds: number) =>
      feeVars
        ?.fees(
          feeVars.blockTimestamp + seconds,
          feeVars.total.collateralRatioIsBelowCritical(feeVars.price)
        )
        .borrowingRate();

    const currentBorrowingRate = decayBorrowingRate(0);
    const adjustedTrove = trove.adjust(normalizedParams, currentBorrowingRate);
    const hints = await this._findHints(adjustedTrove, overrides.from);

    const {
      maxBorrowingRate,
      borrowingFeeDecayToleranceMinutes
    } = normalizeBorrowingOperationOptionalParams(
      maxBorrowingRateOrOptionalParams,
      currentBorrowingRate
    );

    const txParams = (borrowMoUSD?: Decimal): Parameters<typeof borrowerOperations.adjustTrove> => [
      maxBorrowingRate.hex,
      (withdrawCollateral ?? Decimal.ZERO).hex,
      (borrowMoUSD ?? repayMoUSD ?? Decimal.ZERO).hex,
      !!borrowMoUSD,
      ...hints,
      { value: depositCollateral?.hex, ...overrides }
    ];

    let gasHeadroom: number | undefined;

    if (overrides.gasLimit === undefined) {
      const decayedBorrowingRate = decayBorrowingRate(60 * borrowingFeeDecayToleranceMinutes);
      const decayedTrove = trove.adjust(normalizedParams, decayedBorrowingRate);
      const { borrowMoUSD: borrowMoUSDSimulatingDecay } = trove.adjustTo(
        decayedTrove,
        currentBorrowingRate
      );

      if (decayedTrove.debt.lt(MoUSD_MINIMUM_DEBT)) {
        throw new Error(
          `Trove's debt might fall below ${MoUSD_MINIMUM_DEBT} ` +
            `within ${borrowingFeeDecayToleranceMinutes} minutes`
        );
      }

      const [gasNow, gasLater] = await Promise.all([
        borrowerOperations.estimateGas.adjustTrove(...txParams(borrowMoUSD)),
        borrowMoUSD &&
          borrowerOperations.estimateGas.adjustTrove(...txParams(borrowMoUSDSimulatingDecay))
      ]);

      let gasLimit = bigNumberMax(addGasForPotentialListTraversal(gasNow), gasLater);

      if (borrowMoUSD) {
        gasLimit = addGasForBaseRateUpdate(borrowingFeeDecayToleranceMinutes)(gasLimit);
      }

      gasHeadroom = gasLimit.sub(gasNow).toNumber();
      overrides = { ...overrides, gasLimit };
    }

    return this._wrapTroveChangeWithFees(
      normalizedParams,
      await borrowerOperations.populateTransaction.adjustTrove(...txParams(borrowMoUSD)),
      gasHeadroom
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.claimCollateralSurplus} */
  async claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { borrowerOperations } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await borrowerOperations.estimateAndPopulate.claimCollateral(overrides, id)
    );
  }

  /** @internal */
  async setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { priceFeed } = _getContracts(this._readable.connection);

    if (!_priceFeedIsTestnet(priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Mosaic");
    }

    return this._wrapSimpleTransaction(
      await priceFeed.estimateAndPopulate.setPrice(overrides, id, Decimal.from(price).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.liquidate} */
  async liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<LiquidationDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { troveManager } = _getContracts(this._readable.connection);

    if (Array.isArray(address)) {
      return this._wrapLiquidation(
        await troveManager.estimateAndPopulate.batchLiquidateTroves(
          overrides,
          addGasForMSICIssuance,
          address
        )
      );
    } else {
      return this._wrapLiquidation(
        await troveManager.estimateAndPopulate.liquidate(overrides, addGasForMSICIssuance, address)
      );
    }
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.liquidateUpTo} */
  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<LiquidationDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { troveManager } = _getContracts(this._readable.connection);

    return this._wrapLiquidation(
      await troveManager.estimateAndPopulate.liquidateTroves(
        overrides,
        addGasForMSICIssuance,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.depositMoUSDInStabilityPool} */
  async depositMoUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<StabilityDepositChangeDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);
    const depositMoUSD = Decimal.from(amount);

    return this._wrapStabilityDepositTopup(
      { depositMoUSD },
      await stabilityPool.estimateAndPopulate.provideToSP(
        overrides,
        addGasForMSICIssuance,
        depositMoUSD.hex,
        frontendTag ?? this._readable.connection.frontendTag ?? AddressZero
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.withdrawMoUSDFromStabilityPool} */
  async withdrawMoUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<StabilityDepositChangeDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapStabilityDepositWithdrawal(
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        overrides,
        addGasForMSICIssuance,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.withdrawGainsFromStabilityPool} */
  async withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<StabilityPoolGainsWithdrawalDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapStabilityPoolGainsWithdrawal(
      await stabilityPool.estimateAndPopulate.withdrawFromSP(
        overrides,
        addGasForMSICIssuance,
        Decimal.ZERO.hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.transferCollateralGainToTrove} */
  async transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<CollateralGainTransferDetails>> {
    overrides = this._prepareOverrides(overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);

    const [initialTrove, stabilityDeposit] = await Promise.all([
      this._readable.getTrove(overrides.from),
      this._readable.getStabilityDeposit(overrides.from)
    ]);

    const finalTrove = initialTrove.addCollateral(stabilityDeposit.collateralGain);

    return this._wrapCollateralGainTransfer(
      await stabilityPool.estimateAndPopulate.withdrawETHGainToTrove(
        overrides,
        compose(addGasForPotentialListTraversal, addGasForMSICIssuance),
        ...(await this._findHints(finalTrove, overrides.from))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.sendMoUSD} */
  async sendMoUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { msicToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await msicToken.estimateAndPopulate.transfer(
        overrides,
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.sendMSIC} */
  async sendMSIC(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { msicToken } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await msicToken.estimateAndPopulate.transfer(
        overrides,
        id,
        toAddress,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.redeemMoUSD} */
  async redeemMoUSD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersRedemption> {
    const preparedOverrides = this._prepareOverrides(overrides);
    const { troveManager } = _getContracts(this._readable.connection);
    const attemptedMoUSDAmount = Decimal.from(amount);

    const [
      fees,
      total,
      [truncatedAmount, firstRedemptionHint, ...partialHints]
    ] = await Promise.all([
      this._readable.getFees(),
      this._readable.getTotal(),
      this._findRedemptionHints(attemptedMoUSDAmount)
    ]);

    if (truncatedAmount.isZero) {
      throw new Error(
        `redeemMoUSD: amount too low to redeem (try at least ${MoUSD_MINIMUM_NET_DEBT})`
      );
    }

    const defaultMaxRedemptionRate = (amount: Decimal) =>
      Decimal.min(
        fees.redemptionRate(amount.div(total.debt)).add(defaultRedemptionRateSlippageTolerance),
        Decimal.ONE
      );

    const populateRedemption = async (
      attemptedMoUSDAmount: Decimal,
      maxRedemptionRate?: Decimalish,
      truncatedAmount: Decimal = attemptedMoUSDAmount,
      partialHints: [string, string, BigNumberish] = [AddressZero, AddressZero, 0]
    ): Promise<PopulatedEthersRedemption> => {
      const maxRedemptionRateOrDefault =
        maxRedemptionRate !== undefined
          ? Decimal.from(maxRedemptionRate)
          : defaultMaxRedemptionRate(truncatedAmount);

      return new PopulatedEthersRedemption(
        await troveManager.estimateAndPopulate.redeemCollateral(
          preparedOverrides,
          addGasForBaseRateUpdate(),
          truncatedAmount.hex,
          firstRedemptionHint,
          ...partialHints,
          _redeemMaxIterations,
          maxRedemptionRateOrDefault.hex
        ),

        this._readable.connection,
        attemptedMoUSDAmount,
        truncatedAmount,

        truncatedAmount.lt(attemptedMoUSDAmount)
          ? newMaxRedemptionRate =>
              populateRedemption(
                truncatedAmount.add(MoUSD_MINIMUM_NET_DEBT),
                newMaxRedemptionRate ?? maxRedemptionRate
              )
          : undefined
      );
    };

    return populateRedemption(attemptedMoUSDAmount, maxRedemptionRate, truncatedAmount, partialHints);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.stakeMSIC} */
  async stakeMSIC(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { msicStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await msicStaking.estimateAndPopulate.stake(overrides, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.unstakeMSIC} */
  async unstakeMSIC(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { msicStaking } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await msicStaking.estimateAndPopulate.unstake(overrides, id, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    return this.unstakeMSIC(Decimal.ZERO, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.registerFrontend} */
  async registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { stabilityPool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await stabilityPool.estimateAndPopulate.registerFrontEnd(
        overrides,
        id,
        Decimal.from(kickbackRate).hex
      )
    );
  }

  /** @internal */
  async _mintUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    address ??= _requireAddress(this._readable.connection, overrides);
    overrides = this._prepareOverrides(overrides);
    const { uniToken } = _getContracts(this._readable.connection);

    if (!_uniTokenIsMock(uniToken)) {
      throw new Error("_mintUniToken() unavailable on this deployment of Mosaic");
    }

    return this._wrapSimpleTransaction(
      await uniToken.estimateAndPopulate.mint(overrides, id, address, Decimal.from(amount).hex)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.approveUniTokens} */
  async approveUniTokens(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { uniToken, unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await uniToken.estimateAndPopulate.approve(
        overrides,
        id,
        unipool.address,
        Decimal.from(allowance ?? Decimal.INFINITY).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.stakeUniTokens} */
  async stakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.stake(
        overrides,
        addGasForUnipoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.unstakeUniTokens} */
  async unstakeUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdraw(
        overrides,
        addGasForUnipoolRewardUpdate,
        Decimal.from(amount).hex
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.withdrawMSICRewardFromLiquidityMining} */
  async withdrawMSICRewardFromLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.claimReward(overrides, addGasForUnipoolRewardUpdate)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableMosaic.exitLiquidityMining} */
  async exitLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersMosaicTransaction<void>> {
    overrides = this._prepareOverrides(overrides);
    const { unipool } = _getContracts(this._readable.connection);

    return this._wrapSimpleTransaction(
      await unipool.estimateAndPopulate.withdrawAndClaim(overrides, addGasForUnipoolRewardUpdate)
    );
  }
}

import assert from "assert";
import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  MosaicStoreState,
  MosaicStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  MSICStake,
  MosaicStore,
  Fees
} from "@mosaic/lib-base";

import { decimalify, promiseAllValues } from "./_utils";
import { ReadableEthersMosaic } from "./ReadableEthersMosaic";
import { EthersMosaicConnection, _getProvider } from "./EthersMosaicConnection";
import { EthersCallOverrides, EthersProvider } from "./types";

/**
 * Extra state added to {@link @mosaic/lib-base#MosaicStoreState} by
 * {@link BlockPolledMosaicStore}.
 *
 * @public
 */
export interface BlockPolledMosaicStoreExtraState {
  /**
   * Number of block that the store state was fetched from.
   *
   * @remarks
   * May be undefined when the store state is fetched for the first time.
   */
  blockTag?: number;

  /**
   * Timestamp of latest block (number of seconds since epoch).
   */
  blockTimestamp: number;

  /** @internal */
  _feesFactory: (blockTimestamp: number, recoveryMode: boolean) => Fees;
}

/**
 * The type of {@link BlockPolledMosaicStore}'s
 * {@link @mosaic/lib-base#MosaicStore.state | state}.
 *
 * @public
 */
export type BlockPolledMosaicStoreState = MosaicStoreState<BlockPolledMosaicStoreExtraState>;

/**
 * Ethers-based {@link @mosaic/lib-base#MosaicStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledMosaicStore extends MosaicStore<BlockPolledMosaicStoreExtraState> {
  readonly connection: EthersMosaicConnection;

  private readonly _readable: ReadableEthersMosaic;
  private readonly _provider: EthersProvider;

  constructor(readable: ReadableEthersMosaic) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
  }

  private async _getRiskiestTroveBeforeRedistribution(
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const riskiestTroves = await this._readable.getTroves(
      { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true },
      overrides
    );

    if (riskiestTroves.length === 0) {
      return new TroveWithPendingRedistribution(AddressZero, "nonExistent");
    }

    return riskiestTroves[0];
  }

  private async _get(
    blockTag?: number
  ): Promise<[baseState: MosaicStoreBaseState, extraState: BlockPolledMosaicStoreExtraState]> {
    const { userAddress, frontendTag } = this.connection;

    const {
      blockTimestamp,
      _feesFactory,
      calculateRemainingMSIC,
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: this._readable._getBlockTimestamp(blockTag),
      _feesFactory: this._readable._getFeesFactory({ blockTag }),
      calculateRemainingMSIC: this._readable._getRemainingLiquidityMiningMSICRewardCalculator({
        blockTag
      }),

      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      msicInStabilityPool: this._readable.getMoUSDInStabilityPool({ blockTag }),
      totalStakedMSIC: this._readable.getTotalStakedMSIC({ blockTag }),
      _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution({ blockTag }),
      totalStakedUniTokens: this._readable.getTotalStakedUniTokens({ blockTag }),
      remainingStabilityPoolMSICReward: this._readable.getRemainingStabilityPoolMSICReward({
        blockTag
      }),

      frontend: frontendTag
        ? this._readable.getFrontendStatus(frontendTag, { blockTag })
        : { status: "unregistered" as const },

      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            msicBalance: this._readable.getMoUSDBalance(userAddress, { blockTag }),
            msicBalance: this._readable.getMSICBalance(userAddress, { blockTag }),
            uniTokenBalance: this._readable.getUniTokenBalance(userAddress, { blockTag }),
            uniTokenAllowance: this._readable.getUniTokenAllowance(userAddress, { blockTag }),
            liquidityMiningStake: this._readable.getLiquidityMiningStake(userAddress, { blockTag }),
            liquidityMiningMSICReward: this._readable.getLiquidityMiningMSICReward(userAddress, {
              blockTag
            }),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(userAddress, {
              blockTag
            }),
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag }),
            msicStake: this._readable.getMSICStake(userAddress, { blockTag }),
            ownFrontend: this._readable.getFrontendStatus(userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            msicBalance: Decimal.ZERO,
            msicBalance: Decimal.ZERO,
            uniTokenBalance: Decimal.ZERO,
            uniTokenAllowance: Decimal.ZERO,
            liquidityMiningStake: Decimal.ZERO,
            liquidityMiningMSICReward: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            troveBeforeRedistribution: new TroveWithPendingRedistribution(
              AddressZero,
              "nonExistent"
            ),
            stabilityDeposit: new StabilityDeposit(
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              AddressZero
            ),
            msicStake: new MSICStake(),
            ownFrontend: { status: "unregistered" as const }
          })
    });

    return [
      {
        ...baseState,
        _feesInNormalMode: _feesFactory(blockTimestamp, false),
        remainingLiquidityMiningMSICReward: calculateRemainingMSIC(blockTimestamp)
      },
      {
        blockTag,
        blockTimestamp,
        _feesFactory
      }
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(...state);
      }
    });

    const handleBlock = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    let latestBlock: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const blockListener = (blockTag: number) => {
      latestBlock = Math.max(blockTag, latestBlock ?? blockTag);

      if (timerId !== undefined) {
        clearTimeout(timerId);
      }

      timerId = setTimeout(() => {
        assert(latestBlock !== undefined);
        handleBlock(latestBlock);
      }, 50);
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);

      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledMosaicStoreExtraState,
    stateUpdate: Partial<BlockPolledMosaicStoreExtraState>
  ): BlockPolledMosaicStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
      _feesFactory: stateUpdate._feesFactory ?? oldState._feesFactory
    };
  }
}

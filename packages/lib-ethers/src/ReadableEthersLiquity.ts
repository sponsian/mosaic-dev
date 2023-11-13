import { BlockTag } from "@ethersproject/abstract-provider";

import {
  Decimal,
  Fees,
  FrontendStatus,
  MosaicStore,
  MSICStake,
  ReadableMosaic,
  StabilityDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove,
  UserTroveStatus
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";

import { decimalify, numberify, panic } from "./_utils";
import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  EthersMosaicConnection,
  EthersMosaicConnectionOptionalParams,
  EthersMosaicStoreOption,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress,
  _requireFrontendAddress
} from "./EthersMosaicConnection";

import { BlockPolledMosaicStore } from "./BlockPolledMosaicStore";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to MosaicDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999037758833783000");
const BETA = Decimal.from(2);

enum BackendTroveStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  closedByRedemption
}

const userTroveStatusFrom = (backendStatus: BackendTroveStatus): UserTroveStatus =>
  backendStatus === BackendTroveStatus.nonExistent
    ? "nonExistent"
    : backendStatus === BackendTroveStatus.active
    ? "open"
    : backendStatus === BackendTroveStatus.closedByOwner
    ? "closedByOwner"
    : backendStatus === BackendTroveStatus.closedByLiquidation
    ? "closedByLiquidation"
    : backendStatus === BackendTroveStatus.closedByRedemption
    ? "closedByRedemption"
    : panic(new Error(`invalid backendStatus ${backendStatus}`));

const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

const validSortingOptions = ["ascendingCollateralRatio", "descendingCollateralRatio"];

const expectPositiveInt = <K extends string>(obj: { [P in K]?: number }, key: K) => {
  if (obj[key] !== undefined) {
    if (!Number.isInteger(obj[key])) {
      throw new Error(`${key} must be an integer`);
    }

    if (obj[key] < 0) {
      throw new Error(`${key} must not be negative`);
    }
  }
};

/**
 * Ethers-based implementation of {@link @liquity/lib-base#ReadableMosaic}.
 *
 * @public
 */
export class ReadableEthersMosaic implements ReadableMosaic {
  readonly connection: EthersMosaicConnection;

  /** @internal */
  constructor(connection: EthersMosaicConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersMosaicConnection & { useStore: "blockPolled" }
  ): ReadableEthersMosaicWithStore<BlockPolledMosaicStore>;

  /** @internal */
  static _from(connection: EthersMosaicConnection): ReadableEthersMosaic;

  /** @internal */
  static _from(connection: EthersMosaicConnection): ReadableEthersMosaic {
    const readable = new ReadableEthersMosaic(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersMosaic(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersMosaicConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersMosaicWithStore<BlockPolledMosaicStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMosaicConnectionOptionalParams
  ): Promise<ReadableEthersMosaic>;

  /**
   * Connect to the Mosaic protocol and create a `ReadableEthersMosaic` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersMosaicConnectionOptionalParams
  ): Promise<ReadableEthersMosaic> {
    return ReadableEthersMosaic._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersMosaic` is a {@link ReadableEthersMosaicWithStore}.
   */
  hasStore(): this is ReadableEthersMosaicWithStore;

  /**
   * Check whether this `ReadableEthersMosaic` is a
   * {@link ReadableEthersMosaicWithStore}\<{@link BlockPolledMosaicStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersMosaicWithStore<BlockPolledMosaicStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_ETH({ ...overrides }).then(decimalify),
      troveManager.L_MoUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTroveBeforeRedistribution} */
  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { troveManager } = _getContracts(this.connection);

    const [trove, snapshot] = await Promise.all([
      troveManager.Troves(address, { ...overrides }),
      troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (trove.status === BackendTroveStatus.active) {
      return new TroveWithPendingRedistribution(
        address,
        userTroveStatusFrom(trove.status),
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(snapshot.REEF), decimalify(snapshot.MoUSDDebt))
      );
    } else {
      return new TroveWithPendingRedistribution(address, userTroveStatusFrom(trove.status));
    }
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTrove} */
  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, overrides),
      this.getTotalRedistributed(overrides)
    ]);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getNumberOfTroves} */
  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this.connection);

    return (await troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return priceFeed.callStatic.fetchPrice({ ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getETH({ ...overrides }),
        activePool.getMoUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getETH({ ...overrides }),
        defaultPool.getMoUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(overrides),
      this._getDefaultPool(overrides)
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [
      { frontEndTag, initialValue },
      currentMoUSD,
      collateralGain,
      msicReward
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedMoUSDDeposit(address, { ...overrides }),
      stabilityPool.getDepositorETHGain(address, { ...overrides }),
      stabilityPool.getDepositorMSICGain(address, { ...overrides })
    ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentMoUSD),
      decimalify(collateralGain),
      decimalify(msicReward),
      frontEndTag
    );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getRemainingStabilityPoolMSICReward} */
  async getRemainingStabilityPoolMSICReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { communityIssuance } = _getContracts(this.connection);

    const issuanceCap = this.connection.totalStabilityPoolMSICReward;
    const totalMSICIssued = decimalify(await communityIssuance.totalMSICIssued({ ...overrides }));

    // totalMSICIssued approaches but never reaches issuanceCap
    return issuanceCap.sub(totalMSICIssued);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getMoUSDInStabilityPool} */
  getMoUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalMoUSDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getMoUSDBalance} */
  getMoUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { msicToken } = _getContracts(this.connection);

    return msicToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getMSICBalance} */
  getMSICBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { msicToken } = _getContracts(this.connection);

    return msicToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getUniTokenBalance} */
  getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken } = _getContracts(this.connection);

    return uniToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getUniTokenAllowance} */
  getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { uniToken, unipool } = _getContracts(this.connection);

    return uniToken.allowance(address, unipool.address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getRemainingLiquidityMiningMSICRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    const { unipool } = _getContracts(this.connection);

    const [totalSupply, rewardRate, periodFinish, lastUpdateTime] = await Promise.all([
      unipool.totalSupply({ ...overrides }),
      unipool.rewardRate({ ...overrides }).then(decimalify),
      unipool.periodFinish({ ...overrides }).then(numberify),
      unipool.lastUpdateTime({ ...overrides }).then(numberify)
    ]);

    return (blockTimestamp: number) =>
      rewardRate.mul(
        Math.max(0, periodFinish - (totalSupply.isZero() ? lastUpdateTime : blockTimestamp))
      );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getRemainingLiquidityMiningMSICReward} */
  async getRemainingLiquidityMiningMSICReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const [calculateRemainingMSIC, blockTimestamp] = await Promise.all([
      this._getRemainingLiquidityMiningMSICRewardCalculator(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return calculateRemainingMSIC(blockTimestamp);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getLiquidityMiningStake} */
  getLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTotalStakedUniTokens} */
  getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { unipool } = _getContracts(this.connection);

    return unipool.totalSupply({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getLiquidityMiningMSICReward} */
  getLiquidityMiningMSICReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { unipool } = _getContracts(this.connection);

    return unipool.earned(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool.getCollateral(address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.(getTroves:2)} */
  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  async getTroves(
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, backendTroves] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed({ ...overrides }),
      multiTroveGetter.getMultipleSortedTroves(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const troves = mapBackendTroves(backendTroves);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return _getBlockTimestamp(this.connection, blockTag);
  }

  /** @internal */
  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { troveManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    return (blockTimestamp, recoveryMode) =>
      new Fees(
        baseRateWithoutDecay,
        MINUTE_DECAY_FACTOR,
        BETA,
        convertToDate(lastFeeOperationTime.toNumber()),
        convertToDate(blockTimestamp),
        recoveryMode
      );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(overrides),
      this.getTotal(overrides),
      this.getPrice(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return createFees(blockTimestamp, total.collateralRatioIsBelowCritical(price));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getMSICStake} */
  async getMSICStake(address?: string, overrides?: EthersCallOverrides): Promise<MSICStake> {
    address ??= _requireAddress(this.connection);
    const { msicStaking } = _getContracts(this.connection);

    const [stakedMSIC, collateralGain, msicGain] = await Promise.all(
      [
        msicStaking.stakes(address, { ...overrides }),
        msicStaking.getPendingETHGain(address, { ...overrides }),
        msicStaking.getPendingMoUSDGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new MSICStake(stakedMSIC, collateralGain, msicGain);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getTotalStakedMSIC} */
  async getTotalStakedMSIC(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { msicStaking } = _getContracts(this.connection);

    return msicStaking.totalMSICStaked({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableMosaic.getFrontendStatus} */
  async getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    address ??= _requireFrontendAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const { registered, kickbackRate } = await stabilityPool.frontEnds(address, { ...overrides });

    return registered
      ? { status: "registered", kickbackRate: decimalify(kickbackRate) }
      : { status: "unregistered" };
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type BackendTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapBackendTroves = (troves: BackendTroves): TroveWithPendingRedistribution[] =>
  troves.map(
    trove =>
      new TroveWithPendingRedistribution(
        trove.owner,
        "open", // These Troves are coming from the SortedTroves list, so they must be open
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(trove.snapshotETH), decimalify(trove.snapshotMoUSDDebt))
      )
  );

/**
 * Variant of {@link ReadableEthersMosaic} that exposes a {@link @liquity/lib-base#MosaicStore}.
 *
 * @public
 */
export interface ReadableEthersMosaicWithStore<T extends MosaicStore = MosaicStore>
  extends ReadableEthersMosaic {
  /** An object that implements MosaicStore. */
  readonly store: T;
}

class _BlockPolledReadableEthersMosaic
  implements ReadableEthersMosaicWithStore<BlockPolledMosaicStore> {
  readonly connection: EthersMosaicConnection;
  readonly store: BlockPolledMosaicStore;

  private readonly _readable: ReadableEthersMosaic;

  constructor(readable: ReadableEthersMosaic) {
    const store = new BlockPolledMosaicStore(readable);

    this.store = store;
    this.connection = readable.connection;
    this._readable = readable;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this.store.state.blockTag
    );
  }

  private _userHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.userAddress)
    );
  }

  private _frontendHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.frontendTag)
    );
  }

  hasStore(store?: EthersMosaicStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides)
      ? this.store.state.totalRedistributed
      : this._readable.getTotalRedistributed(overrides);
  }

  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    return this._userHit(address, overrides)
      ? this.store.state.troveBeforeRedistribution
      : this._readable.getTroveBeforeRedistribution(address, overrides);
  }

  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    return this._userHit(address, overrides)
      ? this.store.state.trove
      : this._readable.getTrove(address, overrides);
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    return this._blockHit(overrides)
      ? this.store.state.numberOfTroves
      : this._readable.getNumberOfTroves(overrides);
  }

  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides) ? this.store.state.price : this._readable.getPrice(overrides);
  }

  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides) ? this.store.state.total : this._readable.getTotal(overrides);
  }

  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    return this._userHit(address, overrides)
      ? this.store.state.stabilityDeposit
      : this._readable.getStabilityDeposit(address, overrides);
  }

  async getRemainingStabilityPoolMSICReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingStabilityPoolMSICReward
      : this._readable.getRemainingStabilityPoolMSICReward(overrides);
  }

  async getMoUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.msicInStabilityPool
      : this._readable.getMoUSDInStabilityPool(overrides);
  }

  async getMoUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.msicBalance
      : this._readable.getMoUSDBalance(address, overrides);
  }

  async getMSICBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.msicBalance
      : this._readable.getMSICBalance(address, overrides);
  }

  async getUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.uniTokenBalance
      : this._readable.getUniTokenBalance(address, overrides);
  }

  async getUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.uniTokenAllowance
      : this._readable.getUniTokenAllowance(address, overrides);
  }

  async getRemainingLiquidityMiningMSICReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingLiquidityMiningMSICReward
      : this._readable.getRemainingLiquidityMiningMSICReward(overrides);
  }

  async getLiquidityMiningStake(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.liquidityMiningStake
      : this._readable.getLiquidityMiningStake(address, overrides);
  }

  async getTotalStakedUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedUniTokens
      : this._readable.getTotalStakedUniTokens(overrides);
  }

  async getLiquidityMiningMSICReward(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.liquidityMiningMSICReward
      : this._readable.getLiquidityMiningMSICReward(address, overrides);
  }

  async getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.collateralSurplusBalance
      : this._readable.getCollateralSurplusBalance(address, overrides);
  }

  async _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._blockHit({ blockTag })
      ? this.store.state.blockTimestamp
      : this._readable._getBlockTimestamp(blockTag);
  }

  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._blockHit(overrides)
      ? this.store.state._feesFactory
      : this._readable._getFeesFactory(overrides);
  }

  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    return this._blockHit(overrides) ? this.store.state.fees : this._readable.getFees(overrides);
  }

  async getMSICStake(address?: string, overrides?: EthersCallOverrides): Promise<MSICStake> {
    return this._userHit(address, overrides)
      ? this.store.state.msicStake
      : this._readable.getMSICStake(address, overrides);
  }

  async getTotalStakedMSIC(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedMSIC
      : this._readable.getTotalStakedMSIC(overrides);
  }

  async getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    return this._frontendHit(address, overrides)
      ? this.store.state.frontend
      : this._readable.getFrontendStatus(address, overrides);
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]> {
    return this._readable.getTroves(params, overrides);
  }

  _getActivePool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getRemainingLiquidityMiningMSICRewardCalculator(): Promise<(blockTimestamp: number) => Decimal> {
    throw new Error("Method not implemented.");
  }
}

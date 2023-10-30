import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { MSICStake } from "./MSICStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { FrontendStatus, ReadableMosaic, TroveListingParams } from "./ReadableMosaic";

/** @internal */
export type _ReadableMosaicWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableMosaic]: ReadableMosaic[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _MosaicReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableMosaic]: ReadableMosaic[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableMosaicWithExtraParams<T extends unknown[]>
  extends _ReadableMosaicWithExtraParamsBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;
}

/** @internal */
export interface _MosaicReadCache<T extends unknown[]> extends _MosaicReadCacheBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): TroveWithPendingRedistribution[] | undefined;

  getTroves(params: TroveListingParams, ...extraParams: T): UserTrove[] | undefined;
}

/** @internal */
export class _CachedReadableMosaic<T extends unknown[]>
  implements _ReadableMosaicWithExtraParams<T> {
  private _readable: _ReadableMosaicWithExtraParams<T>;
  private _cache: _MosaicReadCache<T>;

  constructor(readable: _ReadableMosaicWithExtraParams<T>, cache: _MosaicReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotalRedistributed(...extraParams) ??
      this._readable.getTotalRedistributed(...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution> {
    return (
      this._cache.getTroveBeforeRedistribution(address, ...extraParams) ??
      this._readable.getTroveBeforeRedistribution(address, ...extraParams)
    );
  }

  async getTrove(address?: string, ...extraParams: T): Promise<UserTrove> {
    const [troveBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, ...extraParams),
      this.getTotalRedistributed(...extraParams)
    ]);

    return troveBeforeRedistribution.applyRedistribution(totalRedistributed);
  }

  async getNumberOfTroves(...extraParams: T): Promise<number> {
    return (
      this._cache.getNumberOfTroves(...extraParams) ??
      this._readable.getNumberOfTroves(...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return this._cache.getPrice(...extraParams) ?? this._readable.getPrice(...extraParams);
  }

  async getTotal(...extraParams: T): Promise<Trove> {
    return this._cache.getTotal(...extraParams) ?? this._readable.getTotal(...extraParams);
  }

  async getStabilityDeposit(address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getRemainingStabilityPoolMSICReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingStabilityPoolMSICReward(...extraParams) ??
      this._readable.getRemainingStabilityPoolMSICReward(...extraParams)
    );
  }

  async getMoUSDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getMoUSDInStabilityPool(...extraParams) ??
      this._readable.getMoUSDInStabilityPool(...extraParams)
    );
  }

  async getMoUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getMoUSDBalance(address, ...extraParams) ??
      this._readable.getMoUSDBalance(address, ...extraParams)
    );
  }

  async getMSICBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getMSICBalance(address, ...extraParams) ??
      this._readable.getMSICBalance(address, ...extraParams)
    );
  }

  async getUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenBalance(address, ...extraParams) ??
      this._readable.getUniTokenBalance(address, ...extraParams)
    );
  }

  async getUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenAllowance(address, ...extraParams) ??
      this._readable.getUniTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingLiquidityMiningMSICReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingLiquidityMiningMSICReward(...extraParams) ??
      this._readable.getRemainingLiquidityMiningMSICReward(...extraParams)
    );
  }

  async getLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedUniTokens(...extraParams) ??
      this._readable.getTotalStakedUniTokens(...extraParams)
    );
  }

  async getLiquidityMiningMSICReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningMSICReward(address, ...extraParams) ??
      this._readable.getLiquidityMiningMSICReward(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;

  async getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(...extraParams),
      this._cache.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  async getFees(...extraParams: T): Promise<Fees> {
    return this._cache.getFees(...extraParams) ?? this._readable.getFees(...extraParams);
  }

  async getMSICStake(address?: string, ...extraParams: T): Promise<MSICStake> {
    return (
      this._cache.getMSICStake(address, ...extraParams) ??
      this._readable.getMSICStake(address, ...extraParams)
    );
  }

  async getTotalStakedMSIC(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedMSIC(...extraParams) ??
      this._readable.getTotalStakedMSIC(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus(address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}

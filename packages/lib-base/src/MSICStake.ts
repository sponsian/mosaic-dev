import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an MSIC Stake.
 *
 * @public
 */
export type MSICStakeChange<T> =
  | { stakeMSIC: T; unstakeMSIC?: undefined }
  | { stakeMSIC?: undefined; unstakeMSIC: T; unstakeAllMSIC: boolean };

/** 
 * Represents a user's MSIC stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableMosaic.getMSICStake | getMSICStake()} function.

 * @public
 */
export class MSICStake {
  /** The amount of MSIC that's staked. */
  readonly stakedMSIC: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** MEUR gain available to withdraw. */
  readonly msicGain: Decimal;

  /** @internal */
  constructor(stakedMSIC = Decimal.ZERO, collateralGain = Decimal.ZERO, msicGain = Decimal.ZERO) {
    this.stakedMSIC = stakedMSIC;
    this.collateralGain = collateralGain;
    this.msicGain = msicGain;
  }

  get isEmpty(): boolean {
    return this.stakedMSIC.isZero && this.collateralGain.isZero && this.msicGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedMSIC: ${this.stakedMSIC}` +
      `, collateralGain: ${this.collateralGain}` +
      `, msicGain: ${this.msicGain} }`
    );
  }

  /**
   * Compare to another instance of `MSICStake`.
   */
  equals(that: MSICStake): boolean {
    return (
      this.stakedMSIC.eq(that.stakedMSIC) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.msicGain.eq(that.msicGain)
    );
  }

  /**
   * Calculate the difference between this `MSICStake` and `thatStakedMSIC`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedMSIC: Decimalish): MSICStakeChange<Decimal> | undefined {
    thatStakedMSIC = Decimal.from(thatStakedMSIC);

    if (thatStakedMSIC.lt(this.stakedMSIC)) {
      return {
        unstakeMSIC: this.stakedMSIC.sub(thatStakedMSIC),
        unstakeAllMSIC: thatStakedMSIC.isZero
      };
    }

    if (thatStakedMSIC.gt(this.stakedMSIC)) {
      return { stakeMSIC: thatStakedMSIC.sub(this.stakedMSIC) };
    }
  }

  /**
   * Apply a {@link MSICStakeChange} to this `MSICStake`.
   *
   * @returns The new staked MSIC amount.
   */
  apply(change: MSICStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedMSIC;
    }

    if (change.unstakeMSIC !== undefined) {
      return change.unstakeAllMSIC || this.stakedMSIC.lte(change.unstakeMSIC)
        ? Decimal.ZERO
        : this.stakedMSIC.sub(change.unstakeMSIC);
    } else {
      return this.stakedMSIC.add(change.stakeMSIC);
    }
  }
}

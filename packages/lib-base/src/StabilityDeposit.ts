import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositMoUSD: T; withdrawMoUSD?: undefined }
  | { depositMoUSD?: undefined; withdrawMoUSD: T; withdrawAllMoUSD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of MoUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialMoUSD: Decimal;

  /** Amount of MoUSD left in the Stability Deposit. */
  readonly currentMoUSD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up MoUSD. */
  readonly collateralGain: Decimal;

  /** Amount of MSIC rewarded since the last modification of the Stability Deposit. */
  readonly msicReward: Decimal;

  /**
   * Address of frontend through which this Stability Deposit was made.
   *
   * @remarks
   * If the Stability Deposit was made through a frontend that doesn't tag deposits, this will be
   * the zero-address.
   */
  readonly frontendTag: string;

  /** @internal */
  constructor(
    initialMoUSD: Decimal,
    currentMoUSD: Decimal,
    collateralGain: Decimal,
    msicReward: Decimal,
    frontendTag: string
  ) {
    this.initialMoUSD = initialMoUSD;
    this.currentMoUSD = currentMoUSD;
    this.collateralGain = collateralGain;
    this.msicReward = msicReward;
    this.frontendTag = frontendTag;

    if (this.currentMoUSD.gt(this.initialMoUSD)) {
      throw new Error("currentMoUSD can't be greater than initialMoUSD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialMoUSD.isZero &&
      this.currentMoUSD.isZero &&
      this.collateralGain.isZero &&
      this.msicReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialMoUSD: ${this.initialMoUSD}` +
      `, currentMoUSD: ${this.currentMoUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, msicReward: ${this.msicReward}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialMoUSD.eq(that.initialMoUSD) &&
      this.currentMoUSD.eq(that.currentMoUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.msicReward.eq(that.msicReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentMoUSD` in this Stability Deposit and `thatMoUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatMoUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatMoUSD = Decimal.from(thatMoUSD);

    if (thatMoUSD.lt(this.currentMoUSD)) {
      return { withdrawMoUSD: this.currentMoUSD.sub(thatMoUSD), withdrawAllMoUSD: thatMoUSD.isZero };
    }

    if (thatMoUSD.gt(this.currentMoUSD)) {
      return { depositMoUSD: thatMoUSD.sub(this.currentMoUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited MoUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentMoUSD;
    }

    if (change.withdrawMoUSD !== undefined) {
      return change.withdrawAllMoUSD || this.currentMoUSD.lte(change.withdrawMoUSD)
        ? Decimal.ZERO
        : this.currentMoUSD.sub(change.withdrawMoUSD);
    } else {
      return this.currentMoUSD.add(change.depositMoUSD);
    }
  }
}

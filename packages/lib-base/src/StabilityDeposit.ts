import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositMEUR: T; withdrawMEUR?: undefined }
  | { depositMEUR?: undefined; withdrawMEUR: T; withdrawAllMEUR: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of MEUR in the Stability Deposit at the time of the last direct modification. */
  readonly initialMEUR: Decimal;

  /** Amount of MEUR left in the Stability Deposit. */
  readonly currentMEUR: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up MEUR. */
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
    initialMEUR: Decimal,
    currentMEUR: Decimal,
    collateralGain: Decimal,
    msicReward: Decimal,
    frontendTag: string
  ) {
    this.initialMEUR = initialMEUR;
    this.currentMEUR = currentMEUR;
    this.collateralGain = collateralGain;
    this.msicReward = msicReward;
    this.frontendTag = frontendTag;

    if (this.currentMEUR.gt(this.initialMEUR)) {
      throw new Error("currentMEUR can't be greater than initialMEUR");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialMEUR.isZero &&
      this.currentMEUR.isZero &&
      this.collateralGain.isZero &&
      this.msicReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialMEUR: ${this.initialMEUR}` +
      `, currentMEUR: ${this.currentMEUR}` +
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
      this.initialMEUR.eq(that.initialMEUR) &&
      this.currentMEUR.eq(that.currentMEUR) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.msicReward.eq(that.msicReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentMEUR` in this Stability Deposit and `thatMEUR`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatMEUR: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatMEUR = Decimal.from(thatMEUR);

    if (thatMEUR.lt(this.currentMEUR)) {
      return { withdrawMEUR: this.currentMEUR.sub(thatMEUR), withdrawAllMEUR: thatMEUR.isZero };
    }

    if (thatMEUR.gt(this.currentMEUR)) {
      return { depositMEUR: thatMEUR.sub(this.currentMEUR) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited MEUR amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentMEUR;
    }

    if (change.withdrawMEUR !== undefined) {
      return change.withdrawAllMEUR || this.currentMEUR.lte(change.withdrawMEUR)
        ? Decimal.ZERO
        : this.currentMEUR.sub(change.withdrawMEUR);
    } else {
      return this.currentMEUR.add(change.depositMEUR);
    }
  }
}

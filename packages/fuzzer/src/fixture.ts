import { Signer } from "@ethersproject/abstract-signer";

import {
  Decimal,
  Decimalish,
  MSICStake,
  MoUSD_MINIMUM_DEBT,
  StabilityDeposit,
  TransactableMosaic,
  Trove,
  TroveAdjustmentParams
} from "@liquity/lib-base";

import { EthersMosaic as Mosaic } from "@liquity/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference,
  getListOfTroves,
  randomCollateralChange,
  randomDebtChange,
  objToString
} from "./utils";

import { GasHistogram } from "./GasHistogram";

type _GasHistogramsFrom<T> = {
  [P in keyof T]: T[P] extends (...args: never[]) => Promise<infer R> ? GasHistogram<R> : never;
};

type GasHistograms = Pick<
  _GasHistogramsFrom<TransactableMosaic>,
  | "openTrove"
  | "adjustTrove"
  | "closeTrove"
  | "redeemMoUSD"
  | "depositMoUSDInStabilityPool"
  | "withdrawMoUSDFromStabilityPool"
  | "stakeMSIC"
  | "unstakeMSIC"
>;

export class Fixture {
  private readonly deployerMosaic: Mosaic;
  private readonly funder: Signer;
  private readonly funderMosaic: Mosaic;
  private readonly funderAddress: string;
  private readonly frontendAddress: string;
  private readonly gasHistograms: GasHistograms;

  private price: Decimal;

  totalNumberOfLiquidations = 0;

  private constructor(
    deployerMosaic: Mosaic,
    funder: Signer,
    funderMosaic: Mosaic,
    funderAddress: string,
    frontendAddress: string,
    price: Decimal
  ) {
    this.deployerMosaic = deployerMosaic;
    this.funder = funder;
    this.funderMosaic = funderMosaic;
    this.funderAddress = funderAddress;
    this.frontendAddress = frontendAddress;
    this.price = price;

    this.gasHistograms = {
      openTrove: new GasHistogram(),
      adjustTrove: new GasHistogram(),
      closeTrove: new GasHistogram(),
      redeemMoUSD: new GasHistogram(),
      depositMoUSDInStabilityPool: new GasHistogram(),
      withdrawMoUSDFromStabilityPool: new GasHistogram(),
      stakeMSIC: new GasHistogram(),
      unstakeMSIC: new GasHistogram()
    };
  }

  static async setup(
    deployerMosaic: Mosaic,
    funder: Signer,
    funderMosaic: Mosaic,
    frontendAddress: string,
    frontendMosaic: Mosaic
  ) {
    const funderAddress = await funder.getAddress();
    const price = await deployerMosaic.getPrice();

    await frontendMosaic.registerFrontend(Decimal.from(10).div(11));

    return new Fixture(
      deployerMosaic,
      funder,
      funderMosaic,
      funderAddress,
      frontendAddress,
      price
    );
  }

  private async sendMoUSDFromFunder(toAddress: string, amount: Decimalish) {
    amount = Decimal.from(amount);

    const msicBalance = await this.funderMosaic.getMoUSDBalance();

    if (msicBalance.lt(amount)) {
      const trove = await this.funderMosaic.getTrove();
      const total = await this.funderMosaic.getTotal();
      const fees = await this.funderMosaic.getFees();

      const targetCollateralRatio =
        trove.isEmpty || !total.collateralRatioIsBelowCritical(this.price)
          ? 1.51
          : Decimal.max(trove.collateralRatio(this.price).add(0.00001), 1.11);

      let newTrove = trove.isEmpty ? Trove.create({ depositCollateral: 1, borrowMoUSD: 0 }) : trove;
      newTrove = newTrove.adjust({ borrowMoUSD: amount.sub(msicBalance).mul(2) });

      if (newTrove.debt.lt(MoUSD_MINIMUM_DEBT)) {
        newTrove = newTrove.setDebt(MoUSD_MINIMUM_DEBT);
      }

      newTrove = newTrove.setCollateral(newTrove.debt.mulDiv(targetCollateralRatio, this.price));

      if (trove.isEmpty) {
        const params = Trove.recreate(newTrove, fees.borrowingRate());
        console.log(`[funder] openTrove(${objToString(params)})`);
        await this.funderMosaic.openTrove(params);
      } else {
        let newTotal = total.add(newTrove).subtract(trove);

        if (
          !total.collateralRatioIsBelowCritical(this.price) &&
          newTotal.collateralRatioIsBelowCritical(this.price)
        ) {
          newTotal = newTotal.setCollateral(newTotal.debt.mulDiv(1.51, this.price));
          newTrove = trove.add(newTotal).subtract(total);
        }

        const params = trove.adjustTo(newTrove, fees.borrowingRate());
        console.log(`[funder] adjustTrove(${objToString(params)})`);
        await this.funderMosaic.adjustTrove(params);
      }
    }

    await this.funderMosaic.sendMoUSD(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(200 * Math.random() + 100).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerMosaic.setPrice(this.price);

    return this.price;
  }

  async liquidateRandomNumberOfTroves(price: Decimal) {
    const msicInStabilityPoolBefore = await this.deployerMosaic.getMoUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${msicInStabilityPoolBefore}`);

    const trovesBefore = await getListOfTroves(this.deployerMosaic);

    if (trovesBefore.length === 0) {
      console.log("// No Troves to liquidate");
      return;
    }

    const troveOwnersBefore = trovesBefore.map(trove => trove.ownerAddress);
    const lastTrove = trovesBefore[trovesBefore.length - 1];

    if (!lastTrove.collateralRatioIsBelowMinimum(price)) {
      console.log("// No Troves to liquidate");
      return;
    }

    const maximumNumberOfTrovesToLiquidate = Math.floor(50 * Math.random()) + 1;
    console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
    await this.deployerMosaic.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

    const troveOwnersAfter = await getListOfTroveOwners(this.deployerMosaic);
    const liquidatedTroves = listDifference(troveOwnersBefore, troveOwnersAfter);

    if (liquidatedTroves.length > 0) {
      for (const liquidatedTrove of liquidatedTroves) {
        console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
      }
    }

    this.totalNumberOfLiquidations += liquidatedTroves.length;

    const msicInStabilityPoolAfter = await this.deployerMosaic.getMoUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${msicInStabilityPoolAfter}`);
  }

  async openRandomTrove(userAddress: string, mosaic: Mosaic) {
    const total = await mosaic.getTotal();
    const fees = await mosaic.getFees();

    let newTrove: Trove;

    const cannotOpen = (newTrove: Trove) =>
      newTrove.debt.lt(MoUSD_MINIMUM_DEBT) ||
      (total.collateralRatioIsBelowCritical(this.price)
        ? !newTrove.isOpenableInRecoveryMode(this.price)
        : newTrove.collateralRatioIsBelowMinimum(this.price) ||
          total.add(newTrove).collateralRatioIsBelowCritical(this.price));

    // do {
    newTrove = createRandomTrove(this.price);
    // } while (cannotOpen(newTrove));

    await this.funder.sendTransaction({
      to: userAddress,
      value: newTrove.collateral.hex
    });

    const params = Trove.recreate(newTrove, fees.borrowingRate());

    if (cannotOpen(newTrove)) {
      console.log(
        `// [${shortenAddress(userAddress)}] openTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.openTrove.expectFailure(() =>
        mosaic.openTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] openTrove(${objToString(params)})`);

      await this.gasHistograms.openTrove.expectSuccess(() =>
        mosaic.send.openTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async randomlyAdjustTrove(userAddress: string, mosaic: Mosaic, trove: Trove) {
    const total = await mosaic.getTotal();
    const fees = await mosaic.getFees();
    const x = Math.random();

    const params: TroveAdjustmentParams<Decimal> =
      x < 0.333
        ? randomCollateralChange(trove)
        : x < 0.666
        ? randomDebtChange(trove)
        : { ...randomCollateralChange(trove), ...randomDebtChange(trove) };

    const cannotAdjust = (trove: Trove, params: TroveAdjustmentParams<Decimal>) => {
      if (
        params.withdrawCollateral?.gte(trove.collateral) ||
        params.repayMoUSD?.gt(trove.debt.sub(MoUSD_MINIMUM_DEBT))
      ) {
        return true;
      }

      const adjusted = trove.adjust(params, fees.borrowingRate());

      return (
        (params.withdrawCollateral?.nonZero || params.borrowMoUSD?.nonZero) &&
        (adjusted.collateralRatioIsBelowMinimum(this.price) ||
          (total.collateralRatioIsBelowCritical(this.price)
            ? adjusted._nominalCollateralRatio.lt(trove._nominalCollateralRatio)
            : total.add(adjusted).subtract(trove).collateralRatioIsBelowCritical(this.price)))
      );
    };

    if (params.depositCollateral) {
      await this.funder.sendTransaction({
        to: userAddress,
        value: params.depositCollateral.hex
      });
    }

    if (params.repayMoUSD) {
      await this.sendMoUSDFromFunder(userAddress, params.repayMoUSD);
    }

    if (cannotAdjust(trove, params)) {
      console.log(
        `// [${shortenAddress(userAddress)}] adjustTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.adjustTrove.expectFailure(() =>
        mosaic.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] adjustTrove(${objToString(params)})`);

      await this.gasHistograms.adjustTrove.expectSuccess(() =>
        mosaic.send.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async closeTrove(userAddress: string, mosaic: Mosaic, trove: Trove) {
    const total = await mosaic.getTotal();

    if (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      console.log("// Skipping closeTrove() in recovery mode");
      return;
    }

    await this.sendMoUSDFromFunder(userAddress, trove.netDebt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);

    await this.gasHistograms.closeTrove.expectSuccess(() =>
      mosaic.send.closeTrove({ gasPrice: 0 })
    );
  }

  async redeemRandomAmount(userAddress: string, mosaic: Mosaic) {
    const total = await mosaic.getTotal();

    if (total.collateralRatioIsBelowMinimum(this.price)) {
      console.log("// Skipping redeemMoUSD() when TCR < MCR");
      return;
    }

    const amount = benford(10000);
    await this.sendMoUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemMoUSD(${amount})`);

    try {
      await this.gasHistograms.redeemMoUSD.expectSuccess(() =>
        mosaic.send.redeemMoUSD(amount, undefined, { gasPrice: 0 })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("amount too low to redeem")) {
        console.log("// amount too low to redeem");
      } else {
        throw error;
      }
    }
  }

  async depositRandomAmountInStabilityPool(userAddress: string, mosaic: Mosaic) {
    const amount = benford(20000);

    await this.sendMoUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositMoUSDInStabilityPool(${amount})`);

    await this.gasHistograms.depositMoUSDInStabilityPool.expectSuccess(() =>
      mosaic.send.depositMoUSDInStabilityPool(amount, this.frontendAddress, {
        gasPrice: 0
      })
    );
  }

  async withdrawRandomAmountFromStabilityPool(
    userAddress: string,
    mosaic: Mosaic,
    deposit: StabilityDeposit
  ) {
    const [lastTrove] = await mosaic.getTroves({
      first: 1,
      sortedBy: "ascendingCollateralRatio"
    });

    const amount = deposit.currentMoUSD.mul(1.1 * Math.random()).add(10 * Math.random());

    const cannotWithdraw = (amount: Decimal) =>
      amount.nonZero && lastTrove.collateralRatioIsBelowMinimum(this.price);

    if (cannotWithdraw(amount)) {
      console.log(
        `// [${shortenAddress(userAddress)}] ` +
          `withdrawMoUSDFromStabilityPool(${amount}) expected to fail`
      );

      await this.gasHistograms.withdrawMoUSDFromStabilityPool.expectFailure(() =>
        mosaic.withdrawMoUSDFromStabilityPool(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] withdrawMoUSDFromStabilityPool(${amount})`);

      await this.gasHistograms.withdrawMoUSDFromStabilityPool.expectSuccess(() =>
        mosaic.send.withdrawMoUSDFromStabilityPool(amount, { gasPrice: 0 })
      );
    }
  }

  async stakeRandomAmount(userAddress: string, mosaic: Mosaic) {
    const msicBalance = await this.funderMosaic.getMSICBalance();
    const amount = msicBalance.mul(Math.random() / 2);

    await this.funderMosaic.sendMSIC(userAddress, amount);

    if (amount.eq(0)) {
      console.log(`// [${shortenAddress(userAddress)}] stakeMSIC(${amount}) expected to fail`);

      await this.gasHistograms.stakeMSIC.expectFailure(() =>
        mosaic.stakeMSIC(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] stakeMSIC(${amount})`);

      await this.gasHistograms.stakeMSIC.expectSuccess(() =>
        mosaic.send.stakeMSIC(amount, { gasPrice: 0 })
      );
    }
  }

  async unstakeRandomAmount(userAddress: string, mosaic: Mosaic, stake: MSICStake) {
    const amount = stake.stakedMSIC.mul(1.1 * Math.random()).add(10 * Math.random());

    console.log(`[${shortenAddress(userAddress)}] unstakeMSIC(${amount})`);

    await this.gasHistograms.unstakeMSIC.expectSuccess(() =>
      mosaic.send.unstakeMSIC(amount, { gasPrice: 0 })
    );
  }

  async sweepMoUSD(mosaic: Mosaic) {
    const msicBalance = await mosaic.getMoUSDBalance();

    if (msicBalance.nonZero) {
      await mosaic.sendMoUSD(this.funderAddress, msicBalance, { gasPrice: 0 });
    }
  }

  async sweepMSIC(mosaic: Mosaic) {
    const msicBalance = await mosaic.getMSICBalance();

    if (msicBalance.nonZero) {
      await mosaic.sendMSIC(this.funderAddress, msicBalance, { gasPrice: 0 });
    }
  }

  summarizeGasStats(): string {
    return Object.entries(this.gasHistograms)
      .map(([name, histo]) => {
        const results = histo.getResults();

        return (
          `${name},outOfGas,${histo.outOfGasFailures}\n` +
          `${name},failure,${histo.expectedFailures}\n` +
          results
            .map(([intervalMin, frequency]) => `${name},success,${frequency},${intervalMin}\n`)
            .join("")
        );
      })
      .join("");
  }
}

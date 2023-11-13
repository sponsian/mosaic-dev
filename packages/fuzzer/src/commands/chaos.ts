import fs from "fs";

import {
  Decimal,
  Difference,
  MoUSD_MINIMUM_DEBT,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

import { Fixture } from "../fixture";
import { deployer, funder, provider, subgraph } from "../globals";

import {
  checkPoolBalances,
  checkSubgraph,
  checkTroveOrdering,
  connectUsers,
  createRandomWallets,
  getListOfTrovesBeforeRedistribution,
  shortenAddress
} from "../utils";

export interface ChaosParams {
  rounds: number;
  users: number;
  subgraph: boolean;
}

export const chaos = async ({
  rounds: numberOfRounds,
  users: numberOfUsers,
  subgraph: shouldCheckSubgraph
}: ChaosParams) => {
  const [frontend, ...randomUsers] = createRandomWallets(numberOfUsers + 1, provider);

  const [deployerMosaic, funderMosaic, frontendMosaic, ...randomLiquities] = await connectUsers([
    deployer,
    funder,
    frontend,
    ...randomUsers
  ]);

  const fixture = await Fixture.setup(
    deployerMosaic,
    funder,
    funderMosaic,
    frontend.address,
    frontendMosaic
  );

  let previousListOfTroves: TroveWithPendingRedistribution[] | undefined = undefined;

  console.log();
  console.log("// Keys");
  console.log(`[frontend]: ${frontend.privateKey}`);
  randomUsers.forEach(user => console.log(`[${shortenAddress(user.address)}]: ${user.privateKey}`));

  for (let i = 1; i <= numberOfRounds; ++i) {
    console.log();
    console.log(`// Round #${i}`);

    const price = await fixture.setRandomPrice();
    await fixture.liquidateRandomNumberOfTroves(price);

    for (let i = 0; i < randomUsers.length; ++i) {
      const user = randomUsers[i];
      const mosaic = randomLiquities[i];

      const x = Math.random();

      if (x < 0.5) {
        const trove = await mosaic.getTrove();

        if (trove.isEmpty) {
          await fixture.openRandomTrove(user.address, mosaic);
        } else {
          if (x < 0.4) {
            await fixture.randomlyAdjustTrove(user.address, mosaic, trove);
          } else {
            await fixture.closeTrove(user.address, mosaic, trove);
          }
        }
      } else if (x < 0.7) {
        const deposit = await mosaic.getStabilityDeposit();

        if (deposit.initialMoUSD.isZero || x < 0.6) {
          await fixture.depositRandomAmountInStabilityPool(user.address, mosaic);
        } else {
          await fixture.withdrawRandomAmountFromStabilityPool(user.address, mosaic, deposit);
        }
      } else if (x < 0.9) {
        const stake = await mosaic.getMSICStake();

        if (stake.stakedMSIC.isZero || x < 0.8) {
          await fixture.stakeRandomAmount(user.address, mosaic);
        } else {
          await fixture.unstakeRandomAmount(user.address, mosaic, stake);
        }
      } else {
        await fixture.redeemRandomAmount(user.address, mosaic);
      }

      // await fixture.sweepMoUSD(mosaic);
      await fixture.sweepMSIC(mosaic);

      const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerMosaic);
      const totalRedistributed = await deployerMosaic.getTotalRedistributed();

      checkTroveOrdering(listOfTroves, totalRedistributed, price, previousListOfTroves);
      await checkPoolBalances(deployerMosaic, listOfTroves, totalRedistributed);

      previousListOfTroves = listOfTroves;
    }

    if (shouldCheckSubgraph) {
      const blockNumber = await provider.getBlockNumber();
      await subgraph.waitForBlock(blockNumber);
      await checkSubgraph(subgraph, deployerMosaic);
    }
  }

  fs.appendFileSync("chaos.csv", fixture.summarizeGasStats());
};

export const order = async () => {
  const [deployerMosaic, funderMosaic] = await connectUsers([deployer, funder]);

  const initialPrice = await deployerMosaic.getPrice();
  // let initialNumberOfTroves = await funderMosaic.getNumberOfTroves();

  let [firstTrove] = await funderMosaic.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    const funderTrove = await funderMosaic.getTrove();

    const targetCollateralRatio = Decimal.max(
      firstTrove.collateralRatio(initialPrice).add(0.00001),
      1.51
    );

    if (funderTrove.isEmpty) {
      const targetTrove = new Trove(
        MoUSD_MINIMUM_DEBT.mulDiv(targetCollateralRatio, initialPrice),
        MoUSD_MINIMUM_DEBT
      );

      const fees = await funderMosaic.getFees();

      await funderMosaic.openTrove(Trove.recreate(targetTrove, fees.borrowingRate()));
    } else {
      const targetTrove = funderTrove.setCollateral(
        funderTrove.debt.mulDiv(targetCollateralRatio, initialPrice)
      );

      await funderMosaic.adjustTrove(funderTrove.adjustTo(targetTrove));
    }
  }

  [firstTrove] = await funderMosaic.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    throw new Error("didn't manage to hoist Funder's Trove to head of SortedTroves");
  }

  await deployerMosaic.setPrice(0.001);

  let numberOfTroves: number;
  while ((numberOfTroves = await funderMosaic.getNumberOfTroves()) > 1) {
    const numberOfTrovesToLiquidate = numberOfTroves > 10 ? 10 : numberOfTroves - 1;

    console.log(`${numberOfTroves} Troves left.`);
    await funderMosaic.liquidateUpTo(numberOfTrovesToLiquidate);
  }

  await deployerMosaic.setPrice(initialPrice);

  if ((await funderMosaic.getNumberOfTroves()) !== 1) {
    throw new Error("didn't manage to liquidate every Trove");
  }

  const funderTrove = await funderMosaic.getTrove();
  const total = await funderMosaic.getTotal();

  const collateralDifference = Difference.between(total.collateral, funderTrove.collateral);
  const debtDifference = Difference.between(total.debt, funderTrove.debt);

  console.log();
  console.log("Discrepancies:");
  console.log(`Collateral: ${collateralDifference}`);
  console.log(`Debt: ${debtDifference}`);
};

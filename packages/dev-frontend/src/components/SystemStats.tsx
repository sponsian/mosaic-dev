import React from "react";
import { Card, Heading, Link, Box, Text } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { Decimal, Percent, MosaicStoreState } from "@liquity/lib-base";
import { useMosaicSelector } from "@liquity/lib-react";

import { useMosaic } from "../hooks/MosaicContext";
import { Statistic } from "./Statistic";
import * as l from "../lexicon";

const selectBalances = ({ accountBalance, msicBalance, msicBalance }: MosaicStoreState) => ({
  accountBalance,
  msicBalance,
  msicBalance
});

const Balances: React.FC = () => {
  const { accountBalance, msicBalance, msicBalance } = useMosaicSelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Statistic lexicon={l.REEF}>{accountBalance.prettify(4)}</Statistic>
      <Statistic lexicon={l.MoUSD}>{msicBalance.prettify()}</Statistic>
      <Statistic lexicon={l.MSIC}>{msicBalance.prettify()}</Statistic>
    </Box>
  );
};

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/mosaic/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  );

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  numberOfTroves,
  price,
  total,
  msicInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMSIC,
  frontend
}: MosaicStoreState) => ({
  numberOfTroves,
  price,
  total,
  msicInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedMSIC,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const {
    mosaic: {
      connection: { version: contractsVersion, deploymentDate, frontendTag }
    }
  } = useMosaic();

  const {
    numberOfTroves,
    price,
    msicInStabilityPool,
    total,
    borrowingRate,
    totalStakedMSIC,
    kickbackRate
  } = useMosaicSelector(select);

  const msicInStabilityPoolPct =
    total.debt.nonZero && new Percent(msicInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify();

  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <Heading>Mosaic statistics</Heading>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Protocol
      </Heading>

      <Statistic lexicon={l.BORROW_FEE}>{borrowingFeePct.toString(2)}</Statistic>

      <Statistic lexicon={l.TVL}>
        {total.collateral.shorten()} <Text sx={{ fontSize: 1 }}>&nbsp;REEF</Text>
        <Text sx={{ fontSize: 1 }}>
          &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
        </Text>
      </Statistic>
      <Statistic lexicon={l.TROVES}>{Decimal.from(numberOfTroves).prettify(0)}</Statistic>
      <Statistic lexicon={l.MoUSD_SUPPLY}>{total.debt.shorten()}</Statistic>
      {msicInStabilityPoolPct && (
        <Statistic lexicon={l.STABILITY_POOL_MoUSD}>
          {msicInStabilityPool.shorten()}
          <Text sx={{ fontSize: 1 }}>&nbsp;({msicInStabilityPoolPct.toString(1)})</Text>
        </Statistic>
      )}
      <Statistic lexicon={l.STAKED_MSIC}>{totalStakedMSIC.shorten()}</Statistic>
      <Statistic lexicon={l.TCR}>{totalCollateralRatioPct.prettify()}</Statistic>
      <Statistic lexicon={l.RECOVERY_MODE}>
        {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
      </Statistic>
      {}

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Frontend
      </Heading>
      {kickbackRatePct && <Statistic lexicon={l.KICKBACK_RATE}>{kickbackRatePct}%</Statistic>}

      <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Box sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
        <Box sx={{ fontSize: 0 }}>Deployed: {deploymentDate.toLocaleString()}</Box>
        <Box sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          {import.meta.env.DEV ? (
            "development"
          ) : (
            <GitHubCommit>{import.meta.env.VITE_APP_VERSION}</GitHubCommit>
          )}
        </Box>
      </Box>
    </Card>
  );
};

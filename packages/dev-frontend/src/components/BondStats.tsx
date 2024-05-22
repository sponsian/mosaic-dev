import React from "react";
import { Card, Heading, Text, Flex } from "theme-ui";
import { Decimal } from "@mosaic/lib-base";
import * as l from "../components/Bonds/lexicon";
import { Statistic } from "./Statistic";
import { TreasuryChart } from "./TreasuryChart";
import { useBondView } from "./Bonds/context/BondViewContext";

type BondStatsProps = {
  variant?: string;
};

type MetricProps = {
  value: string | undefined;
  unit?: string;
};

const Metric: React.FC<MetricProps> = ({ value, unit }) => {
  return (
    <>
      {value}
      &nbsp;
      {unit && <Text sx={{ fontWeight: "light", fontSize: 1 }}>{unit}</Text>}
    </>
  );
};

export const BondStats: React.FC<BondStatsProps> = () => {
  const { stats, protocolInfo } = useBondView();

  if (stats === undefined || protocolInfo === undefined) return null;

  return (
    <Card variant="info">
      <Heading sx={{ fontweight: "bold" }}>MoUSD bonds</Heading>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        bMoUSD
      </Heading>
      <Statistic lexicon={l.BMoUSD_MARKET_PRICE}>
        <Metric value={protocolInfo.marketPrice.prettify(3)} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_FAIR_PRICE}>
        <Metric
          value={
            protocolInfo.fairPrice.lower.eq(Decimal.INFINITY)
              ? "N/A"
              : `${protocolInfo.fairPrice.lower.prettify(
                  2
                )} - ${protocolInfo.fairPrice.upper.prettify(2)}`
          }
          unit="MoUSD"
        />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_FLOOR_PRICE}>
        <Metric value={protocolInfo.floorPriceWithoutPendingHarvests.prettify(4)} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_WIND_DOWN_PRICE}>
        <Metric value={protocolInfo.windDownPrice.prettify(4)} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_APR}>
        <Metric
          value={
            protocolInfo.bMousdApr && protocolInfo.bMousdSupply.gt(0)
              ? protocolInfo.bMousdApr.mul(100).prettify(2)
              : "N/A"
          }
          unit="%"
        />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_LP_APR}>
        <Metric
          value={
            protocolInfo?.bMousdLpApr !== undefined ? protocolInfo.bMousdLpApr.prettify(2) : "N/A"
          }
          unit="%"
        />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_YIELD_AMPLIFICATION}>
        <Metric
          value={
            protocolInfo.yieldAmplification && protocolInfo.bMousdSupply.gt(0)
              ? protocolInfo.yieldAmplification.prettify(2)
              : "N/A"
          }
          unit="x"
        />
      </Statistic>
      <Statistic lexicon={l.BMoUSD_SUPPLY}>
        <Metric value={protocolInfo.bMousdSupply.shorten()} unit="bMoUSD" />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Statistics
      </Heading>
      <Statistic lexicon={l.PENDING_BONDS_STATISTIC}>
        <Metric value={stats.pendingBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.CANCELLED_BONDS_STATISTIC}>
        <Metric value={stats.cancelledBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.CLAIMED_BONDS_STATISTIC}>
        <Metric value={stats.claimedBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.TOTAL_BONDS_STATISTIC}>
        <Metric value={stats.totalBonds.prettify(0)} />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Treasury
      </Heading>
      <Statistic lexicon={l.TREASURY_PENDING}>
        <Metric value={protocolInfo.treasury.pending.shorten()} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_ACQUIRED}>
        <Metric value={protocolInfo.treasury.reserve.shorten()} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_PERMANENT}>
        <Metric value={protocolInfo.treasury.permanent.shorten()} unit="MoUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_TOTAL}>
        <Metric value={protocolInfo.treasury.total.shorten()} unit="MoUSD" />
      </Statistic>

      <Flex mt={3}>
        <TreasuryChart />
      </Flex>
    </Card>
  );
};

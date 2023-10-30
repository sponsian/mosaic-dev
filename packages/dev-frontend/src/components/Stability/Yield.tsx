import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { Decimal, MosaicStoreState } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";
import { InfoIcon } from "../InfoIcon";
import { Badge } from "../Badge";
import { fetchMsicPrice } from "./context/fetchMsicPrice";

const selector = ({ msicInStabilityPool, remainingStabilityPoolMSICReward }: MosaicStoreState) => ({
  msicInStabilityPool,
  remainingStabilityPoolMSICReward
});

const yearlyIssuanceFraction = 0.5;
const dailyIssuanceFraction = Decimal.from(1 - yearlyIssuanceFraction ** (1 / 365));
const dailyIssuancePercentage = dailyIssuanceFraction.mul(100);

export const Yield: React.FC = () => {
  const { msicInStabilityPool, remainingStabilityPoolMSICReward } = useMosaicSelector(selector);

  const [msicPrice, setMsicPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingStabilityPoolMSICReward.isZero || msicInStabilityPool.isZero;

  useEffect(() => {
    (async () => {
      try {
        const { msicPriceUSD } = await fetchMsicPrice();
        setMsicPrice(msicPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  if (hasZeroValue || msicPrice === undefined) return null;

  const msicIssuanceOneDay = remainingStabilityPoolMSICReward.mul(dailyIssuanceFraction);
  const msicIssuanceOneDayInUSD = msicIssuanceOneDay.mul(msicPrice);
  const aprPercentage = msicIssuanceOneDayInUSD.mulDiv(365 * 100, msicInStabilityPool);
  const remainingMsicInUSD = remainingStabilityPoolMSICReward.mul(msicPrice);

  if (aprPercentage.isZero) return null;

  return (
    <Badge>
      <Text>MSIC APR {aprPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ width: ["220px", "518px"] }}>
            <Paragraph>
              An <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the MSIC return on the MoUSD
              deposited to the Stability Pool over the next year, not including your ETH gains from
              liquidations.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($MSIC_REWARDS * DAILY_ISSUANCE% / DEPOSITED_MoUSD) * 365 * 100 ={" "}
              <Text sx={{ fontWeight: "bold" }}> APR</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingMsicInUSD.shorten()} * {dailyIssuancePercentage.toString(4)}% / $
              {msicInStabilityPool.shorten()}) * 365 * 100 =
              <Text sx={{ fontWeight: "bold" }}> {aprPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};

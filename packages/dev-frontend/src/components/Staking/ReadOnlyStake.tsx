import { Heading, Box, Card, Flex, Button } from "theme-ui";

import { MosaicStoreState } from "@liquity/lib-base";
import { useMosaicSelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { Icon } from "../Icon";

import { useStakingView } from "./context/StakingViewContext";
import { StakingGainsAction } from "./StakingGainsAction";

const select = ({ msicStake, totalStakedMSIC }: MosaicStoreState) => ({
  msicStake,
  totalStakedMSIC
});

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView();
  const { msicStake, totalStakedMSIC } = useMosaicSelector(select);

  const poolShare = msicStake.stakedMSIC.mulDiv(100, totalStakedMSIC);

  return (
    <Card>
      <Heading>Staking</Heading>

      <Box sx={{ p: [2, 3] }}>
        <DisabledEditableRow
          label="Stake"
          inputId="stake-msic"
          amount={msicStake.stakedMSIC.prettify()}
          unit={GT}
        />

        <StaticRow
          label="Pool share"
          inputId="stake-share"
          amount={poolShare.prettify(4)}
          unit="%"
        />

        <StaticRow
          label="Redemption gain"
          inputId="stake-gain-eth"
          amount={msicStake.collateralGain.prettify(4)}
          color={msicStake.collateralGain.nonZero && "success"}
          unit="REEF"
        />

        <StaticRow
          label="Issuance gain"
          inputId="stake-gain-msic"
          amount={msicStake.msicGain.prettify()}
          color={msicStake.msicGain.nonZero && "success"}
          unit={COIN}
        />

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={() => dispatch({ type: "startAdjusting" })}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <StakingGainsAction />
        </Flex>
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};

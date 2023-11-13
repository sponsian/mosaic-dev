import { Button } from "theme-ui";

import { MosaicStoreState } from "@liquity/lib-base";
import { useMosaicSelector } from "@liquity/lib-react";

import { useMosaic } from "../../hooks/MosaicContext";
import { useTransactionFunction } from "../Transaction";

const selectMSICStake = ({ msicStake }: MosaicStoreState) => msicStake;

export const StakingGainsAction: React.FC = () => {
  const { mosaic } = useMosaic();
  const { collateralGain, msicGain } = useMosaicSelector(selectMSICStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    mosaic.send.withdrawGainsFromStaking.bind(mosaic.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={collateralGain.isZero && msicGain.isZero}>
      Claim gains
    </Button>
  );
};

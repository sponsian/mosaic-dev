import { Button } from "theme-ui";

import { MosaicStoreState } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";

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

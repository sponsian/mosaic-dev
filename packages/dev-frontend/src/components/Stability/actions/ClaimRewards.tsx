import React from "react";
import { Button } from "theme-ui";

import { useMosaic } from "../../../hooks/MosaicContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimRewardsProps = {
  disabled?: boolean;
};

export const ClaimRewards: React.FC<ClaimRewardsProps> = ({ disabled, children }) => {
  const { mosaic } = useMosaic();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    mosaic.send.withdrawGainsFromStabilityPool.bind(mosaic.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={disabled}>
      {children}
    </Button>
  );
};

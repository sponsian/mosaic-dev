import React from "react";
import { Button } from "theme-ui";
import { useMosaic } from "../../../hooks/MosaicContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimAndMoveProps = {
  disabled?: boolean;
};

export const ClaimAndMove: React.FC<ClaimAndMoveProps> = ({ disabled, children }) => {
  const { mosaic } = useMosaic();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    mosaic.send.transferCollateralGainToTrove.bind(mosaic.send)
  );

  return (
    <Button
      variant="outline"
      sx={{ mt: 3, width: "100%" }}
      onClick={sendTransaction}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};

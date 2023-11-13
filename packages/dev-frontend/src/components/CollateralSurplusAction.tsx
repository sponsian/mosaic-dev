import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { MosaicStoreState } from "@liquity/lib-base";
import { useMosaicSelector } from "@liquity/lib-react";

import { useMosaic } from "../hooks/MosaicContext";

import { Transaction, useMyTransactionState } from "./Transaction";
import { useTroveView } from "./Trove/context/TroveViewContext";

const select = ({ collateralSurplusBalance }: MosaicStoreState) => ({
  collateralSurplusBalance
});

export const CollateralSurplusAction: React.FC = () => {
  const { collateralSurplusBalance } = useMosaicSelector(select);
  const {
    mosaic: { send: mosaic }
  } = useMosaic();

  const myTransactionId = "claim-coll-surplus";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const { dispatchEvent } = useTroveView();

  useEffect(() => {
    if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_SURPLUS_COLLATERAL_CLAIMED");
    }
  }, [myTransactionState.type, dispatchEvent]);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : myTransactionState.type !== "waitingForConfirmation" &&
    myTransactionState.type !== "confirmed" ? (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        send={mosaic.claimCollateralSurplus.bind(mosaic, undefined)}
      >
        <Button sx={{ mx: 2 }}>Claim {collateralSurplusBalance.prettify()} REEF</Button>
      </Transaction>
    </Flex>
  ) : null;
};

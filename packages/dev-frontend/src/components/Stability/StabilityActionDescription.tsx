import React from "react";

import { Decimal, StabilityDeposit, StabilityDepositChange } from "@mosaic/lib-base";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

type StabilityActionDescriptionProps = {
  originalDeposit: StabilityDeposit;
  change: StabilityDepositChange<Decimal>;
};

export const StabilityActionDescription: React.FC<StabilityActionDescriptionProps> = ({
  originalDeposit,
  change
}) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" REEF");
  const msicReward = originalDeposit.msicReward.nonZero?.prettify().concat(" ", GT);

  return (
    <ActionDescription>
      {change.depositMEUR ? (
        <>
          You are depositing{" "}
          <Amount>
            {change.depositMEUR.prettify()} {COIN}
          </Amount>{" "}
          in the Stability Pool
        </>
      ) : (
        <>
          You are withdrawing{" "}
          <Amount>
            {change.withdrawMEUR.prettify()} {COIN}
          </Amount>{" "}
          to your wallet
        </>
      )}
      {(collateralGain || msicReward) && (
        <>
          {" "}
          and claiming at least{" "}
          {collateralGain && msicReward ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{msicReward}</Amount>
            </>
          ) : (
            <Amount>{collateralGain ?? msicReward}</Amount>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};

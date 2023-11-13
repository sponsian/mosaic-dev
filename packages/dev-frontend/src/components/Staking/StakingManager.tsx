import React from "react";
import { Button, Flex } from "theme-ui";

import {
  Decimal,
  Decimalish,
  MosaicStoreState,
  MSICStake,
  MSICStakeChange
} from "@liquity/lib-base";

import { MosaicStoreUpdate, useMosaicReducer, useMosaicSelector } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";

const init = ({ msicStake }: MosaicStoreState) => ({
  originalStake: msicStake,
  editedMSIC: msicStake.stakedMSIC
});

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | MosaicStoreUpdate
  | { type: "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedMSIC } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedMSIC: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedMSIC: originalStake.stakedMSIC };

    case "updateStore": {
      const {
        stateChange: { msicStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedMSIC: updatedStake.apply(originalStake.whatChanged(editedMSIC))
        };
      }
    }
  }

  return state;
};

const selectMSICBalance = ({ msicBalance }: MosaicStoreState) => msicBalance;

type StakingManagerActionDescriptionProps = {
  originalStake: MSICStake;
  change: MSICStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  originalStake,
  change
}) => {
  const stakeMSIC = change.stakeMSIC?.prettify().concat(" ", GT);
  const unstakeMSIC = change.unstakeMSIC?.prettify().concat(" ", GT);
  const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" REEF");
  const msicGain = originalStake.msicGain.nonZero?.prettify().concat(" ", COIN);

  if (originalStake.isEmpty && stakeMSIC) {
    return (
      <ActionDescription>
        You are staking <Amount>{stakeMSIC}</Amount>.
      </ActionDescription>
    );
  }

  return (
    <ActionDescription>
      {stakeMSIC && (
        <>
          You are adding <Amount>{stakeMSIC}</Amount> to your stake
        </>
      )}
      {unstakeMSIC && (
        <>
          You are withdrawing <Amount>{unstakeMSIC}</Amount> to your wallet
        </>
      )}
      {(collateralGain || msicGain) && (
        <>
          {" "}
          and claiming{" "}
          {collateralGain && msicGain ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{msicGain}</Amount>
            </>
          ) : (
            <>
              <Amount>{collateralGain ?? msicGain}</Amount>
            </>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};

export const StakingManager: React.FC = () => {
  const { dispatch: dispatchStakingViewAction } = useStakingView();
  const [{ originalStake, editedMSIC }, dispatch] = useMosaicReducer(reduce, init);
  const msicBalance = useMosaicSelector(selectMSICBalance);

  const change = originalStake.whatChanged(editedMSIC);
  const [validChange, description] = !change
    ? [undefined, undefined]
    : change.stakeMSIC?.gt(msicBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeMSIC.sub(msicBalance).prettify()} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, <StakingManagerActionDescription originalStake={originalStake} change={change} />];

  const makingNewStake = originalStake.isEmpty;

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedMSIC, dispatch }}>
      {description ??
        (makingNewStake ? (
          <ActionDescription>Enter the amount of {GT} you'd like to stake.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {GT} amount to stake or withdraw.</ActionDescription>
        ))}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={() => dispatchStakingViewAction({ type: "cancelAdjusting" })}
        >
          Cancel
        </Button>

        {validChange ? (
          <StakingManagerAction change={validChange}>Confirm</StakingManagerAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </StakingEditor>
  );
};

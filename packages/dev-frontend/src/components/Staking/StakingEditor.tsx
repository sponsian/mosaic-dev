import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference, MosaicStoreState, MSICStake } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

import { useStakingView } from "./context/StakingViewContext";

const select = ({ msicBalance, totalStakedMSIC }: MosaicStoreState) => ({
  msicBalance,
  totalStakedMSIC
});

type StakingEditorProps = {
  title: string;
  originalStake: MSICStake;
  editedMSIC: Decimal;
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StakingEditor: React.FC<StakingEditorProps> = ({
  children,
  title,
  originalStake,
  editedMSIC,
  dispatch
}) => {
  const { msicBalance, totalStakedMSIC } = useMosaicSelector(select);
  const { changePending } = useStakingView();
  const editingState = useState<string>();

  const edited = !editedMSIC.eq(originalStake.stakedMSIC);

  const maxAmount = originalStake.stakedMSIC.add(msicBalance);
  const maxedOut = editedMSIC.eq(maxAmount);

  const totalStakedMSICAfterChange = totalStakedMSIC.sub(originalStake.stakedMSIC).add(editedMSIC);

  const originalPoolShare = originalStake.stakedMSIC.mulDiv(100, totalStakedMSIC);
  const newPoolShare = editedMSIC.mulDiv(100, totalStakedMSICAfterChange);
  const poolShareChange =
    originalStake.stakedMSIC.nonZero && Difference.between(newPoolShare, originalPoolShare).nonZero;

  return (
    <Card>
      <Heading>
        {title}
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="stake-msic"
          amount={editedMSIC.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={GT}
          {...{ editingState }}
          editedAmount={editedMSIC.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setStake", newValue })}
        />

        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" inputId="stake-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="stake-share"
            amount={newPoolShare.prettify(4)}
            pendingAmount={poolShareChange?.prettify(4).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
            unit="%"
          />
        )}

        {!originalStake.isEmpty && (
          <>
            <StaticRow
              label="Redemption gain"
              inputId="stake-gain-eth"
              amount={originalStake.collateralGain.prettify(4)}
              color={originalStake.collateralGain.nonZero && "success"}
              unit="REEF"
            />

            <StaticRow
              label="Issuance gain"
              inputId="stake-gain-msic"
              amount={originalStake.msicGain.prettify()}
              color={originalStake.msicGain.nonZero && "success"}
              unit={COIN}
            />
          </>
        )}

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};

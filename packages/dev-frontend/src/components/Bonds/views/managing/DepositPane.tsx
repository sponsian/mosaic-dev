import { Decimal } from "@mosaic/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Checkbox, Label, Card, Text } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { InfoIcon } from "../../../InfoIcon";
import { DisabledEditableRow, EditableRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BMousdAmmTokenIndex } from "../../context/transitions";
import { PoolDetails } from "./PoolDetails";
import type { Address, ApprovePressedPayload } from "../../context/transitions";

export const DepositPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    msicBalance,
    bMousdBalance,
    isBMousdApprovedWithAmmZapper,
    isMousdApprovedWithAmmZapper,
    getExpectedLpTokens,
    addresses,
    bMousdAmmBMousdBalance,
    bMousdAmmMousdBalance
  } = useBondView();

  const editingState = useState<string>();
  const [bMousdAmount, setBMousdAmount] = useState<Decimal>(Decimal.ZERO);
  const [msicAmount, setMousdAmount] = useState<Decimal>(Decimal.ZERO);
  const [lpTokens, setLpTokens] = useState<Decimal>(Decimal.ZERO);
  const [shouldStakeInGauge, setShouldStakeInGauge] = useState(true);
  const [shouldDepositBalanced, setShouldDepositBalanced] = useState(true);

  const coalescedBMousdBalance = bMousdBalance ?? Decimal.ZERO;
  const coalescedMousdBalance = msicBalance ?? Decimal.ZERO;

  const isApprovePending = statuses.APPROVE_SPENDER === "PENDING";
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBMousdBalanceInsufficient = bMousdAmount.gt(coalescedBMousdBalance);
  const isMousdBalanceInsufficient = msicAmount.gt(coalescedMousdBalance);
  const isAnyBalanceInsufficient = isBMousdBalanceInsufficient || isMousdBalanceInsufficient;

  const isDepositingMousd = msicAmount.gt(0);
  const isDepositingBMousd = bMousdAmount.gt(0);

  const zapperNeedsMousdApproval = isDepositingMousd && !isMousdApprovedWithAmmZapper;
  const zapperNeedsBMousdApproval = isDepositingBMousd && !isBMousdApprovedWithAmmZapper;
  const isApprovalNeeded = zapperNeedsMousdApproval || zapperNeedsBMousdApproval;

  const poolBalanceRatio =
    bMousdAmmBMousdBalance && bMousdAmmMousdBalance
      ? bMousdAmmMousdBalance.div(bMousdAmmBMousdBalance)
      : Decimal.ONE;

  const handleApprovePressed = () => {
    const tokensNeedingApproval = new Map<BMousdAmmTokenIndex, Address>();
    if (zapperNeedsMousdApproval) {
      tokensNeedingApproval.set(BMousdAmmTokenIndex.MoUSD, addresses.BMoUSD_LP_ZAP_ADDRESS);
    }
    if (zapperNeedsBMousdApproval) {
      tokensNeedingApproval.set(BMousdAmmTokenIndex.BMoUSD, addresses.BMoUSD_LP_ZAP_ADDRESS);
    }

    dispatchEvent("APPROVE_PRESSED", { tokensNeedingApproval } as ApprovePressedPayload);
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "addLiquidity",
      bMousdAmount,
      msicAmount,
      minLpTokens: lpTokens,
      shouldStakeInGauge
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  const handleToggleShouldStakeInGauge = () => {
    setShouldStakeInGauge(toggle => !toggle);
  };

  const handleToggleShouldDepositBalanced = () => {
    if (!shouldDepositBalanced) {
      setBMousdAmount(Decimal.ZERO);
      setMousdAmount(Decimal.ZERO);
    }
    setShouldDepositBalanced(toggle => !toggle);
  };

  const handleSetAmount = (token: "bMoUSD" | "MoUSD", amount: Decimal) => {
    if (shouldDepositBalanced) {
      if (token === "bMoUSD") setMousdAmount(poolBalanceRatio.mul(amount));
      else if (token === "MoUSD") setBMousdAmount(amount.div(poolBalanceRatio));
    }

    if (token === "bMoUSD") setBMousdAmount(amount);
    else if (token === "MoUSD") setMousdAmount(amount);
  };

  useEffect(() => {
    if (bMousdAmount.isZero && msicAmount.isZero) {
      setLpTokens(Decimal.ZERO);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const expectedLpTokens = await getExpectedLpTokens(bMousdAmount, msicAmount);
        if (cancelled) return;
        setLpTokens(expectedLpTokens);
      } catch (error) {
        console.error("getExpectedLpTokens() failed");
        console.log(error);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [bMousdAmount, msicAmount, getExpectedLpTokens]);

  return (
    <>
      <EditableRow
        label="bMoUSD amount"
        inputId="deposit-bmsic"
        amount={bMousdAmount.prettify(2)}
        unit="bMoUSD"
        editingState={editingState}
        editedAmount={bMousdAmount.toString()}
        setEditedAmount={amount => handleSetAmount("bMoUSD", Decimal.from(amount))}
        maxAmount={coalescedBMousdBalance.toString()}
        maxedOut={bMousdAmount.eq(coalescedBMousdBalance)}
      />

      <EditableRow
        label="MoUSD amount"
        inputId="deposit-msic"
        amount={msicAmount.prettify(2)}
        unit="MoUSD"
        editingState={editingState}
        editedAmount={msicAmount.toString()}
        setEditedAmount={amount => handleSetAmount("MoUSD", Decimal.from(amount))}
        maxAmount={coalescedMousdBalance.toString()}
        maxedOut={msicAmount.eq(coalescedMousdBalance)}
      />

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        <Icon name="arrow-down" size="lg" />
      </Flex>

      <DisabledEditableRow
        label="Mint LP tokens"
        inputId="deposit-mint-lp-tokens"
        amount={lpTokens.prettify(2)}
      />

      <Label>
        <Flex sx={{ alignItems: "center" }}>
          <Checkbox checked={shouldDepositBalanced} onChange={handleToggleShouldDepositBalanced} />
          <Text sx={{ fontWeight: 300, fontSize: "16px" }}>Deposit tokens in a balanced ratio</Text>
          <InfoIcon
            placement="right"
            size="xs"
            tooltip={
              <Card variant="tooltip">
                Tick this box to deposit bMoUSD and MoUSD-3CRV in the pool's current liquidity ratio.
                Current ratio = 1 bMoUSD : {poolBalanceRatio.prettify(2)} MoUSD.
              </Card>
            }
          />
        </Flex>
      </Label>

      <Label mb={2}>
        <Flex sx={{ alignItems: "center" }}>
          <Checkbox checked={shouldStakeInGauge} onChange={handleToggleShouldStakeInGauge} />
          <Text sx={{ fontWeight: 300, fontSize: "16px" }}>Stake LP tokens in Curve gauge</Text>
          <InfoIcon
            placement="right"
            size="xs"
            tooltip={
              <Card variant="tooltip">
                Tick this box to have your Curve LP tokens staked in the bMoUSD Curve gauge. Staked LP
                tokens will earn protocol fees and Curve rewards.
              </Card>
            }
          />
        </Flex>
      </Label>

      <PoolDetails />

      {isAnyBalanceInsufficient && (
        <ErrorDescription>
          Deposit exceeds your balance by{" "}
          {isBMousdBalanceInsufficient && (
            <>
              <Amount>{bMousdAmount.sub(coalescedBMousdBalance).prettify(2)} bMoUSD</Amount>
              {isMousdBalanceInsufficient && <> and </>}
            </>
          )}
          {isMousdBalanceInsufficient && (
            <Amount>{msicAmount.sub(coalescedMousdBalance).prettify(2)} MoUSD</Amount>
          )}
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={handleBackPressed}
          disabled={isApprovePending || isManageLiquidityPending}
        >
          Back
        </Button>

        {!isApprovalNeeded ? (
          <Button
            variant="primary"
            onClick={handleConfirmPressed}
            disabled={
              (bMousdAmount.isZero && msicAmount.isZero) ||
              isAnyBalanceInsufficient ||
              isManageLiquidityPending
            }
          >
            {isManageLiquidityPending ? (
              <Spinner size="28px" sx={{ color: "white" }} />
            ) : (
              <>Confirm</>
            )}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleApprovePressed} disabled={isApprovePending}>
            {isApprovePending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Approve</>}
          </Button>
        )}
      </Flex>
    </>
  );
};

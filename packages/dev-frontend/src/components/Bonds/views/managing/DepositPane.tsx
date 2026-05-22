import { Decimal } from "@mosaic/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Checkbox, Label, Card, Text } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { InfoIcon } from "../../../InfoIcon";
import { DisabledEditableRow, EditableRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BMeurAmmTokenIndex } from "../../context/transitions";
import { PoolDetails } from "./PoolDetails";
import type { Address, ApprovePressedPayload } from "../../context/transitions";

export const DepositPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    meurBalance,
    bMeurBalance,
    isBMeurApprovedWithAmmZapper,
    isMeurApprovedWithAmmZapper,
    getExpectedLpTokens,
    addresses,
    bMeurAmmBMeurBalance,
    bMeurAmmMeurBalance
  } = useBondView();

  const editingState = useState<string>();
  const [bMeurAmount, setBMeurAmount] = useState<Decimal>(Decimal.ZERO);
  const [msicAmount, setMeurAmount] = useState<Decimal>(Decimal.ZERO);
  const [lpTokens, setLpTokens] = useState<Decimal>(Decimal.ZERO);
  const [shouldStakeInGauge, setShouldStakeInGauge] = useState(true);
  const [shouldDepositBalanced, setShouldDepositBalanced] = useState(true);

  const coalescedBMeurBalance = bMeurBalance ?? Decimal.ZERO;
  const coalescedMeurBalance = meurBalance ?? Decimal.ZERO;

  const isApprovePending = statuses.APPROVE_SPENDER === "PENDING";
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBMeurBalanceInsufficient = bMeurAmount.gt(coalescedBMeurBalance);
  const isMeurBalanceInsufficient = msicAmount.gt(coalescedMeurBalance);
  const isAnyBalanceInsufficient = isBMeurBalanceInsufficient || isMeurBalanceInsufficient;

  const isDepositingMeur = msicAmount.gt(0);
  const isDepositingBMeur = bMeurAmount.gt(0);

  const zapperNeedsMeurApproval = isDepositingMeur && !isMeurApprovedWithAmmZapper;
  const zapperNeedsBMeurApproval = isDepositingBMeur && !isBMeurApprovedWithAmmZapper;
  const isApprovalNeeded = zapperNeedsMeurApproval || zapperNeedsBMeurApproval;

  const poolBalanceRatio =
    bMeurAmmBMeurBalance && bMeurAmmMeurBalance
      ? bMeurAmmMeurBalance.div(bMeurAmmBMeurBalance)
      : Decimal.ONE;

  const handleApprovePressed = () => {
    const tokensNeedingApproval = new Map<BMeurAmmTokenIndex, Address>();
    if (zapperNeedsMeurApproval) {
      tokensNeedingApproval.set(BMeurAmmTokenIndex.MEUR, addresses.BMEUR_LP_ZAP_ADDRESS);
    }
    if (zapperNeedsBMeurApproval) {
      tokensNeedingApproval.set(BMeurAmmTokenIndex.BMEUR, addresses.BMEUR_LP_ZAP_ADDRESS);
    }

    dispatchEvent("APPROVE_PRESSED", { tokensNeedingApproval } as ApprovePressedPayload);
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "addLiquidity",
      bMeurAmount,
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
      setBMeurAmount(Decimal.ZERO);
      setMeurAmount(Decimal.ZERO);
    }
    setShouldDepositBalanced(toggle => !toggle);
  };

  const handleSetAmount = (token: "bMEUR" | "MEUR", amount: Decimal) => {
    if (shouldDepositBalanced) {
      if (token === "bMEUR") setMeurAmount(poolBalanceRatio.mul(amount));
      else if (token === "MEUR") setBMeurAmount(amount.div(poolBalanceRatio));
    }

    if (token === "bMEUR") setBMeurAmount(amount);
    else if (token === "MEUR") setMeurAmount(amount);
  };

  useEffect(() => {
    if (bMeurAmount.isZero && msicAmount.isZero) {
      setLpTokens(Decimal.ZERO);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const expectedLpTokens = await getExpectedLpTokens(bMeurAmount, msicAmount);
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
  }, [bMeurAmount, msicAmount, getExpectedLpTokens]);

  return (
    <>
      <EditableRow
        label="bMEUR amount"
        inputId="deposit-bmsic"
        amount={bMeurAmount.prettify(2)}
        unit="bMEUR"
        editingState={editingState}
        editedAmount={bMeurAmount.toString()}
        setEditedAmount={amount => handleSetAmount("bMEUR", Decimal.from(amount))}
        maxAmount={coalescedBMeurBalance.toString()}
        maxedOut={bMeurAmount.eq(coalescedBMeurBalance)}
      />

      <EditableRow
        label="MEUR amount"
        inputId="deposit-msic"
        amount={msicAmount.prettify(2)}
        unit="MEUR"
        editingState={editingState}
        editedAmount={msicAmount.toString()}
        setEditedAmount={amount => handleSetAmount("MEUR", Decimal.from(amount))}
        maxAmount={coalescedMeurBalance.toString()}
        maxedOut={msicAmount.eq(coalescedMeurBalance)}
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
                Tick this box to deposit bMEUR and MEUR-3CRV in the pool's current liquidity ratio.
                Current ratio = 1 bMEUR : {poolBalanceRatio.prettify(2)} MEUR.
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
                Tick this box to have your Curve LP tokens staked in the bMEUR Curve gauge. Staked LP
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
          {isBMeurBalanceInsufficient && (
            <>
              <Amount>{bMeurAmount.sub(coalescedBMeurBalance).prettify(2)} bMEUR</Amount>
              {isMeurBalanceInsufficient && <> and </>}
            </>
          )}
          {isMeurBalanceInsufficient && (
            <Amount>{msicAmount.sub(coalescedMeurBalance).prettify(2)} MEUR</Amount>
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
              (bMeurAmount.isZero && msicAmount.isZero) ||
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

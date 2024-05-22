import { Decimal } from "@mosaic/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Label, Radio, Text } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { DisabledEditableAmounts, DisabledEditableRow, EditableRow } from "../../../Trove/Editor";
import { Warning } from "../../../Warning";
import { useBondView } from "../../context/BondViewContext";
import { ApprovePressedPayload, BMousdAmmTokenIndex } from "../../context/transitions";
import { PoolDetails } from "./PoolDetails";

const tokenSymbol = new Map([
  [BMousdAmmTokenIndex.BMoUSD, "bMoUSD"],
  [BMousdAmmTokenIndex.MoUSD, "MoUSD"]
]);

const WithdrawnAmount: React.FC<{ symbol: string }> = ({ symbol, children }) => (
  <>
    <Text sx={{ fontWeight: "medium" }}>{children}</Text>
    &nbsp;
    <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{symbol}</Text>
  </>
);

const checkOutput = (value: string): BMousdAmmTokenIndex | "both" => {
  if (value === "both") {
    return "both";
  }

  const i = parseInt(value);
  if (i === BMousdAmmTokenIndex.BMoUSD || i === BMousdAmmTokenIndex.MoUSD) {
    return i;
  }

  throw new Error(`invalid output choice "${value}"`);
};

const zeros = new Map<BMousdAmmTokenIndex, Decimal>([
  [BMousdAmmTokenIndex.BMoUSD, Decimal.ZERO],
  [BMousdAmmTokenIndex.MoUSD, Decimal.ZERO]
]);

export const WithdrawPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    lpTokenBalance,
    getExpectedWithdrawal,
    isBMousdLpApprovedWithAmmZapper,
    stakedLpTokenBalance,
    addresses
  } = useBondView();

  const editingState = useState<string>();
  const [burnLpTokens, setBurnLp] = useState<Decimal>(Decimal.ZERO);
  const [output, setOutput] = useState<BMousdAmmTokenIndex | "both">("both");
  const [withdrawal, setWithdrawal] = useState<Map<BMousdAmmTokenIndex, Decimal>>(zeros);

  const isApprovePending = statuses.APPROVE_SPENDER === "PENDING";
  const coalescedLpTokenBalance = lpTokenBalance ?? Decimal.ZERO;
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBalanceInsufficient = burnLpTokens.gt(coalescedLpTokenBalance);
  const needsApproval = output !== BMousdAmmTokenIndex.BMoUSD && !isBMousdLpApprovedWithAmmZapper;

  const handleApprovePressed = () => {
    const tokensNeedingApproval = new Map();
    if (needsApproval) {
      tokensNeedingApproval.set(BMousdAmmTokenIndex.BMoUSD_MoUSD_LP, addresses.BMoUSD_LP_ZAP_ADDRESS);
    }
    dispatchEvent("APPROVE_PRESSED", { tokensNeedingApproval } as ApprovePressedPayload);
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setOutput(checkOutput(e.target.value));

  const handleConfirmPressed = () => {
    const curveSlippage = 0.001; // Allow mininum of %0.1% slippage due to Curve rounding issues
    if (output === "both") {
      const minBMousdAmount = withdrawal.get(BMousdAmmTokenIndex.BMoUSD)?.mul(1 - curveSlippage);
      const minMousdAmount = withdrawal.get(BMousdAmmTokenIndex.MoUSD)?.mul(1 - curveSlippage);

      if (minBMousdAmount === undefined || minBMousdAmount === Decimal.ZERO) return;
      if (minMousdAmount === undefined || minMousdAmount === Decimal.ZERO) return;

      dispatchEvent("CONFIRM_PRESSED", {
        action: "removeLiquidity",
        burnLpTokens,
        minBMousdAmount,
        minMousdAmount
      });
    } else {
      const minAmount = withdrawal.get(output)?.mul(1 - curveSlippage);

      if (minAmount === undefined || minAmount === Decimal.ZERO) return;

      dispatchEvent("CONFIRM_PRESSED", {
        action: "removeLiquidityOneCoin",
        burnLpTokens,
        output,
        minAmount
      });
    }
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  useEffect(() => {
    if (burnLpTokens.isZero) {
      setWithdrawal(output === "both" ? zeros : new Map([[output, Decimal.ZERO]]));
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const expectedWithdrawal = await getExpectedWithdrawal(burnLpTokens, output);
        if (cancelled) return;
        setWithdrawal(expectedWithdrawal);
      } catch (error) {
        console.error("getExpectedWithdrawal() failed");
        console.log(error);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [burnLpTokens, getExpectedWithdrawal, output]);

  return (
    <>
      {stakedLpTokenBalance?.nonZero && (
        <Warning>
          You {lpTokenBalance?.nonZero && " also "} have {stakedLpTokenBalance.shorten()} staked LP
          tokens. Unstake them to withdraw liquidity from them.
        </Warning>
      )}
      <EditableRow
        label="Burn LP Tokens"
        inputId="withdraw-burn-lp"
        amount={burnLpTokens.prettify(2)}
        editingState={editingState}
        editedAmount={burnLpTokens.toString()}
        setEditedAmount={amount => setBurnLp(Decimal.from(amount))}
        maxAmount={coalescedLpTokenBalance.toString()}
        maxedOut={burnLpTokens.eq(coalescedLpTokenBalance)}
      />

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        <Icon name="arrow-down" size="lg" />
      </Flex>

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        {Array.from(tokenSymbol.entries()).map(([key, symbol]) => (
          <Label key={key} variant="radioLabel">
            <Radio
              name="withdraw-output-choice"
              value={key}
              checked={output === key}
              onChange={handleOutputChange}
            />
            {symbol}
          </Label>
        ))}

        <Label key="both" variant="radioLabel">
          <Radio
            name="withdraw-output-choice"
            value="both"
            checked={output === "both"}
            onChange={handleOutputChange}
          />
          Both
        </Label>
      </Flex>

      <DisabledEditableRow label="Withdraw" inputId="withdraw-output-amount">
        <DisabledEditableAmounts sx={{ justifyContent: "flex-start" }}>
          {Array.from(withdrawal.entries()).map(([token, amount], i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text sx={{ fontWeight: "light", mx: "12px" }}>+</Text>}
              <WithdrawnAmount symbol={tokenSymbol.get(token) ?? ""}>
                {amount.prettify(2)}
              </WithdrawnAmount>
            </React.Fragment>
          ))}
        </DisabledEditableAmounts>
      </DisabledEditableRow>

      <PoolDetails />

      {isBalanceInsufficient && (
        <ErrorDescription>
          LP Token amount exceeds your balance by{" "}
          <Amount>{burnLpTokens.sub(coalescedLpTokenBalance).prettify(2)}</Amount>
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

        {needsApproval && (
          <Button
            variant="primary"
            onClick={handleApprovePressed}
            disabled={burnLpTokens.isZero || isApprovePending}
          >
            {isApprovePending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Approve</>}
          </Button>
        )}

        {!needsApproval && (
          <Button
            variant="primary"
            onClick={handleConfirmPressed}
            disabled={burnLpTokens.isZero || isBalanceInsufficient || isManageLiquidityPending}
          >
            {isManageLiquidityPending ? (
              <Spinner size="28px" sx={{ color: "white" }} />
            ) : (
              <>Confirm</>
            )}
          </Button>
        )}
      </Flex>
    </>
  );
};;

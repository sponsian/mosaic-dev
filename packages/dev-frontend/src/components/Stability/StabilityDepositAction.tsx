import { Button } from "theme-ui";
import { Decimal, MosaicStoreState, StabilityDepositChange } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";

import { useMosaic } from "../../hooks/MosaicContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
};

const selectFrontendRegistered = ({ frontend }: MosaicStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change
}) => {
  const { config, mosaic } = useMosaic();
  const frontendRegistered = useMosaicSelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositMoUSD
      ? mosaic.send.depositMoUSDInStabilityPool.bind(mosaic.send, change.depositMoUSD, frontendTag)
      : mosaic.send.withdrawMoUSDFromStabilityPool.bind(mosaic.send, change.withdrawMoUSD)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};

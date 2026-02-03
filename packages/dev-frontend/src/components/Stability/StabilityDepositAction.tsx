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
    change.depositMEUR
      ? mosaic.send.depositMEURInStabilityPool.bind(mosaic.send, change.depositMEUR, frontendTag)
      : mosaic.send.withdrawMEURFromStabilityPool.bind(mosaic.send, change.withdrawMEUR)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};

import { Button } from "theme-ui";

import { Decimal, MSICStakeChange } from "@mosaic/lib-base";

import { useMosaic } from "../../hooks/MosaicContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: MSICStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { mosaic } = useMosaic();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeMSIC
      ? mosaic.send.stakeMSIC.bind(mosaic.send, change.stakeMSIC)
      : mosaic.send.unstakeMSIC.bind(mosaic.send, change.unstakeMSIC)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};

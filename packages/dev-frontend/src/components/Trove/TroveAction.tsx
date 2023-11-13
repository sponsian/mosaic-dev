import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@liquity/lib-base";

import { useMosaic } from "../../hooks/MosaicContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  maxBorrowingRate,
  borrowingFeeDecayToleranceMinutes
}) => {
  const { mosaic } = useMosaic();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? mosaic.send.openTrove.bind(mosaic.send, change.params, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
      : change.type === "closure"
      ? mosaic.send.closeTrove.bind(mosaic.send)
      : mosaic.send.adjustTrove.bind(mosaic.send, change.params, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};

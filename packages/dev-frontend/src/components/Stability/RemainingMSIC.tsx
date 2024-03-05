import React from "react";
import { Flex } from "theme-ui";

import { MosaicStoreState } from "@liquity/lib-base";
import { useMosaicSelector } from "@liquity/lib-react";

const selector = ({ remainingStabilityPoolMSICReward }: MosaicStoreState) => ({
  remainingStabilityPoolMSICReward
});

export const RemainingMSIC: React.FC = () => {
  const { remainingStabilityPoolMSICReward } = useMosaicSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolMSICReward.prettify(0)} MSIC remaining
    </Flex>
  );
};

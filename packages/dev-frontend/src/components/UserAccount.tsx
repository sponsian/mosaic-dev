import React from "react";
import { Text, Flex, Box, Heading, Button } from "theme-ui";

import { Decimal, MosaicStoreState } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";

import { COIN, GT } from "../strings";
import { useMosaic } from "../hooks/MosaicContext";
import { shortenAddress } from "../utils/shortenAddress";

import { Icon } from "./Icon";
import { useBondView } from "./Bonds/context/BondViewContext";
import { useBondAddresses } from "./Bonds/context/BondAddressesContext";
import { ConnectKitButton } from "connectkit";

const select = ({ accountBalance, msicBalance, msicBalance }: MosaicStoreState) => ({
  accountBalance,
  msicBalance,
  msicBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useMosaic();
  const { accountBalance, msicBalance: realMousdBalance, msicBalance } = useMosaicSelector(select);
  const { bMousdBalance, msicBalance: customMousdBalance } = useBondView();
  const { MoUSD_OVERRIDE_ADDRESS } = useBondAddresses();

  const msicBalance = MoUSD_OVERRIDE_ADDRESS === null ? realMousdBalance : customMousdBalance;

  return (
    <Flex>
      <ConnectKitButton.Custom>
        {connectKit => (
          <Button
            variant="outline"
            sx={{ alignItems: "center", p: 2, mr: 3 }}
            onClick={connectKit.show}
          >
            <Icon name="user-circle" size="lg" />
            <Text as="span" sx={{ ml: 2, fontSize: 1 }}>
              {shortenAddress(account)}
            </Text>
          </Button>
        )}
      </ConnectKitButton.Custom>

      <Box
        sx={{
          display: ["none", "flex"],
          alignItems: "center"
        }}
      >
        <Icon name="wallet" size="lg" />

        {([
          ["REEF", accountBalance],
          [COIN, Decimal.from(msicBalance || 0)],
          [GT, Decimal.from(msicBalance)],
          ["bMoUSD", Decimal.from(bMousdBalance || 0)]
        ] as const).map(([currency, balance], i) => (
          <Flex key={i} sx={{ ml: 3, flexDirection: "column" }}>
            <Heading sx={{ fontSize: 1 }}>{currency}</Heading>
            <Text sx={{ fontSize: 1 }}>{balance.prettify()}</Text>
          </Flex>
        ))}
      </Box>
    </Flex>
  );
};

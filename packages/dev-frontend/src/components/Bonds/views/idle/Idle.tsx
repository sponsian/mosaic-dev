import React, { useEffect, useState } from "react";
import { Card, Box, Heading, Flex, Button } from "theme-ui";
import { Empty } from "./Empty";
import { BondList } from "./BondList";
import { useBondView } from "../../context/BondViewContext";
import { BONDS } from "../../lexicon";
import { InfoIcon } from "../../../InfoIcon";
import { BMousdAmmTokenIndex, SwapPressedPayload } from "../../context/transitions";
import { useMosaic } from "../../../../hooks/MosaicContext";
import { useBondAddresses } from "../../context/BondAddressesContext";

export const Idle: React.FC = () => {
  const { mosaic } = useMosaic();
  const { MEUR_OVERRIDE_ADDRESS } = useBondAddresses();

  const { dispatchEvent, bonds, getMousdFromFaucet, msicBalance, hasLoaded } = useBondView();
  const [chain, setChain] = useState<number>();

  useEffect(() => {
    (async () => {
      if (mosaic.connection.signer === undefined || chain !== undefined) return;
      const chainId = await mosaic.connection.signer.getChainId();
      setChain(chainId);
    })();
  }, [chain, mosaic.connection.signer]);

  if (!hasLoaded) return null;

  const hasBonds = bonds !== undefined && bonds.length > 0;

  const showMousdFaucet = MEUR_OVERRIDE_ADDRESS !== null && msicBalance?.eq(0);

  const handleManageLiquidityPressed = () => dispatchEvent("MANAGE_LIQUIDITY_PRESSED");

  const handleBuyBMousdPressed = () =>
    dispatchEvent("SWAP_PRESSED", { inputToken: BMousdAmmTokenIndex.MEUR } as SwapPressedPayload);

  const handleSellBMousdPressed = () =>
    dispatchEvent("SWAP_PRESSED", { inputToken: BMousdAmmTokenIndex.BMEUR } as SwapPressedPayload);

  return (
    <>
      <Flex variant="layout.actions" sx={{ mt: 4, mb: 3 }}>
        <Button variant="outline" onClick={handleManageLiquidityPressed}>
          Manage liquidity
        </Button>

        <Button variant="outline" onClick={handleBuyBMousdPressed}>
          Buy bMEUR
        </Button>

        <Button variant="outline" onClick={handleSellBMousdPressed}>
          Sell bMEUR
        </Button>

        {showMousdFaucet && (
          <Button variant={hasBonds ? "outline" : "primary"} onClick={() => getMousdFromFaucet()}>
            Get 10k MEUR
          </Button>
        )}

        {hasBonds && (
          <Button variant="primary" onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}>
            Create another bond
          </Button>
        )}
      </Flex>

      {!hasBonds && (
        <Card>
          <Heading>
            <Flex>
              {BONDS.term}
              <InfoIcon
                placement="left"
                size="xs"
                tooltip={<Card variant="tooltip">{BONDS.description}</Card>}
              />
            </Flex>
          </Heading>
          <Box sx={{ p: [2, 3] }}>
            <Empty />

            <Flex variant="layout.actions" mt={4}>
              <Button variant="primary" onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}>
                Create bond
              </Button>
            </Flex>
          </Box>
        </Card>
      )}

      {hasBonds && <BondList />}
    </>
  );
};

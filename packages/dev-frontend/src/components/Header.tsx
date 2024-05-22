import React from "react";
import { MosaicStoreState } from "@mosaic/lib-base";
import { useMosaicSelector } from "@mosaic/lib-react";
import { Container, Flex, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useMosaic } from "../hooks/MosaicContext";

import { MosaicLogo } from "./MosaicLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

const select = ({ frontend }: MosaicStoreState) => ({
  frontend
});

export const Header: React.FC = ({ children }) => {
  const {
    config: { frontendTag }
  } = useMosaic();
  const { frontend } = useMosaicSelector(select);
  const isFrontendRegistered = frontendTag === AddressZero || frontend.status === "registered";

  return (
    <Container variant="header">
      <Flex sx={{ alignItems: "center", flex: 1 }}>
        <MosaicLogo height={logoHeight} />

        <Box
          sx={{
            mx: [2, 3],
            width: "0px",
            height: "100%",
            borderLeft: ["none", "1px solid lightgrey"]
          }}
        />
        {isFrontendRegistered && (
          <>
            <SideNav />
            <Nav />
          </>
        )}
      </Flex>

      {children}
    </Container>
  );
};

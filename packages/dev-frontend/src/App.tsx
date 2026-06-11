import React from "react";
import { createClient, WagmiConfig } from "wagmi";
import { localhost } from "wagmi/chains";
import type { Chain } from "wagmi";

const reefPelagia: Chain = {
  id: 13939,
  name: "Reef Pelagia",
  network: "reef-pelagia",
  nativeCurrency: { name: "REEF", symbol: "REEF", decimals: 18 }, // wagmi requires 18; on-chain REEF is 12 — UI formatting must compensate
  rpcUrls: {
    default: { http: ["https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/"] },
    public:  { http: ["https://eth.reef-node-reefdevcluster-b0be3e-72-60-35-83.nip.io/"] }
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer-frontend-ibcy8d-1204c4-72-60-35-83.nip.io/" }
  },
  testnet: true
};
import { ConnectKitProvider, getDefaultClient } from "connectkit";
import { Flex, Heading, ThemeProvider, Paragraph, Link } from "theme-ui";

// import { BatchedWebSocketAugmentedWeb3Provider } from "@mosaic/providers";
import { MosaicProvider } from "./hooks/MosaicContext";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider } from "./components/Transaction";
import { Icon } from "./components/Icon";
import { getConfig } from "./config";
import theme from "./theme";

import { MosaicFrontend } from "./MosaicFrontend";
import { AppLoader } from "./components/AppLoader";
import { useAsyncValue } from "./hooks/AsyncValue";

// __MOSAIC_DEMO__ is a build-time constant injected by vite.config.ts. The
// demo bootstrap installs a DisposableWalletProvider keyed by a well-known
// dev-chain funder. Keeping that string out of the production bundle is
// critical — static-analysis security scanners (Blockaid etc.) match on
// inline private-key-shaped hex strings near signing calls and flag the
// site as a wallet drainer. Because __MOSAIC_DEMO__ is a literal boolean
// rather than a runtime env-var lookup, terser can dead-code-eliminate the
// entire if-block, and Rollup skips emitting the demoBootstrap chunk too.
const isDemoMode = __MOSAIC_DEMO__;

if (__MOSAIC_DEMO__) {
  void import("./testUtils/demoBootstrap").then(({ installDemoWalletProvider }) => {
    installDemoWalletProvider();
  });
}

// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

const UnsupportedMainnetFallback: React.FC = () => (
  <Flex
    sx={{
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      textAlign: "center"
    }}
  >
    <Heading sx={{ mb: 3 }}>
      <Icon name="exclamation-triangle" /> This app is for testing purposes only.
    </Heading>

    <Paragraph sx={{ mb: 3 }}>Please change your network to Pelagia.</Paragraph>

    <Paragraph>
      If you'd like to use the Mosaic Protocol on Reef testnet, please pick a frontend{" "}
      <Link href="https://testnet.mosaic.markets/">
        here <Icon name="external-link-alt" size="xs" />
      </Link>
      .
    </Paragraph>
  </Flex>
);

const UnsupportedNetworkFallback: React.FC = () => (
  <Flex
    sx={{
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      textAlign: "center"
    }}
  >
    <Heading sx={{ mb: 3 }}>
      <Icon name="exclamation-triangle" /> Mosaic is not supported on this network.
    </Heading>
    Please switch to Reef Pelagia.
  </Flex>
);

const App = () => {
  const config = useAsyncValue(getConfig);
  const loader = <AppLoader />;

  return (
    <ThemeProvider theme={theme}>
      {config.loaded && (
        <WagmiConfig
          client={createClient(
            getDefaultClient({
              appName: "Mosaic",
              chains:
                isDemoMode || import.meta.env.MODE === "test"
                  ? [localhost]
                  : [reefPelagia],
              walletConnectProjectId: config.value.walletConnectProjectId,
              infuraId: config.value.infuraApiKey,
              alchemyId: config.value.alchemyApiKey
            })
          )}
        >
          <ConnectKitProvider options={{ hideBalance: true }}>
            <WalletConnector loader={loader}>
              <MosaicProvider
                loader={loader}
                unsupportedNetworkFallback={<UnsupportedNetworkFallback />}
                unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
              >
                <TransactionProvider>
                  <MosaicFrontend loader={loader} />
                </TransactionProvider>
              </MosaicProvider>
            </WalletConnector>
          </ConnectKitProvider>
        </WagmiConfig>
      )}
    </ThemeProvider>
  );
};

export default App;

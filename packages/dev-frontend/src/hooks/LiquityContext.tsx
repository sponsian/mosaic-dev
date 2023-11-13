import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { FallbackProvider } from "@ethersproject/providers";
import { useProvider, useSigner, useAccount, useChainId } from "wagmi";

import {
  BlockPolledMosaicStore,
  EthersMosaic,
  EthersMosaicWithStore,
  _connectByChainId
} from "@liquity/lib-ethers";

import { MosaicFrontendConfig, getConfig } from "../config";
import { BatchedProvider } from "../providers/BatchingProvider";

type MosaicContextValue = {
  config: MosaicFrontendConfig;
  account: string;
  provider: Provider;
  mosaic: EthersMosaicWithStore<BlockPolledMosaicStore>;
};

const MosaicContext = createContext<MosaicContextValue | undefined>(undefined);

type MosaicProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

export const MosaicProvider: React.FC<MosaicProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const provider = useProvider<FallbackProvider>();
  const signer = useSigner();
  const account = useAccount();
  const chainId = useChainId();
  const [config, setConfig] = useState<MosaicFrontendConfig>();

  const connection = useMemo(() => {
    if (config && provider && signer.data && account.address) {
      const batchedProvider = new BatchedProvider(provider, chainId);
      // batchedProvider._debugLog = true;

      try {
        return _connectByChainId(batchedProvider, signer.data, chainId, {
          userAddress: account.address,
          frontendTag: config.frontendTag,
          useStore: "blockPolled"
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [config, provider, signer.data, account.address, chainId]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config || !provider || !signer.data || !account.address) {
    return <>{loader}</>;
  }

  if (config.testnetOnly && chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  if (!connection) {
    return <>{unsupportedNetworkFallback}</>;
  }

  const mosaic = EthersMosaic._from(connection);
  mosaic.store.logging = true;

  return (
    <MosaicContext.Provider
      value={{ config, account: account.address, provider: connection.provider, mosaic }}
    >
      {children}
    </MosaicContext.Provider>
  );
};

export const useMosaic = () => {
  const mosaicContext = useContext(MosaicContext);

  if (!mosaicContext) {
    throw new Error("You must provide a MosaicContext via MosaicProvider");
  }

  return mosaicContext;
};

import { MosaicStore } from "@mosaic/lib-base";
import React, { createContext, useEffect, useState } from "react";

export const MosaicStoreContext = createContext<MosaicStore | undefined>(undefined);

type MosaicStoreProviderProps = {
  store: MosaicStore;
  loader?: React.ReactNode;
};

export const MosaicStoreProvider: React.FC<MosaicStoreProviderProps> = ({
  store,
  loader,
  children
}) => {
  const [loadedStore, setLoadedStore] = useState<MosaicStore>();

  useEffect(() => {
    store.onLoaded = () => setLoadedStore(store);
    const stop = store.start();

    return () => {
      store.onLoaded = undefined;
      setLoadedStore(undefined);
      stop();
    };
  }, [store]);

  if (!loadedStore) {
    return <>{loader}</>;
  }

  return <MosaicStoreContext.Provider value={loadedStore}>{children}</MosaicStoreContext.Provider>;
};

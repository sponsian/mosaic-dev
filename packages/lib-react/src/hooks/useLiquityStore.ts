import { useContext } from "react";

import { MosaicStore } from "@liquity/lib-base";

import { MosaicStoreContext } from "../components/MosaicStoreProvider";

export const useMosaicStore = <T>(): MosaicStore<T> => {
  const store = useContext(MosaicStoreContext);

  if (!store) {
    throw new Error("You must provide a MosaicStore via MosaicStoreProvider");
  }

  return store as MosaicStore<T>;
};

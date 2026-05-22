import { useEffect, useReducer } from "react";

import { MosaicStoreState } from "@mosaic/lib-base";

import { equals } from "../utils/equals";
import { useMosaicStore } from "./useMosaicStore";

export const useMosaicSelector = <S, T>(select: (state: MosaicStoreState<T>) => S): S => {
  const store = useMosaicStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  useEffect(
    () =>
      store.subscribe(({ newState, oldState }) => {
        if (!equals(select(newState), select(oldState))) {
          rerender();
        }
      }),
    [store, select]
  );

  return select(store.state);
};

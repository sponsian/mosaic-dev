import { useCallback, useEffect, useReducer, useRef } from "react";

import { MosaicStoreState } from "@mosaic/lib-base";

import { equals } from "../utils/equals";
import { useMosaicStore } from "./useMosaicStore";

export type MosaicStoreUpdate<T = unknown> = {
  type: "updateStore";
  newState: MosaicStoreState<T>;
  oldState: MosaicStoreState<T>;
  stateChange: Partial<MosaicStoreState<T>>;
};

export const useMosaicReducer = <S, A, T>(
  reduce: (state: S, action: A | MosaicStoreUpdate<T>) => S,
  init: (storeState: MosaicStoreState<T>) => S
): [S, (action: A | MosaicStoreUpdate<T>) => void] => {
  const store = useMosaicStore<T>();
  const oldStore = useRef(store);
  const state = useRef(init(store.state));
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | MosaicStoreUpdate<T>) => {
      const newState = reduce(state.current, action);

      if (!equals(newState, state.current)) {
        state.current = newState;
        rerender();
      }
    },
    [reduce]
  );

  useEffect(() => store.subscribe(params => dispatch({ type: "updateStore", ...params })), [
    store,
    dispatch
  ]);

  if (oldStore.current !== store) {
    state.current = init(store.state);
    oldStore.current = store;
  }

  return [state.current, dispatch];
};

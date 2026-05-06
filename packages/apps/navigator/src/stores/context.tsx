import { createContext, useContext, type ReactNode } from 'react';
import type { RootStore } from './root-store';

const RootStoreContext = createContext<RootStore | null>(null);

export function RootStoreProvider(props: {
  store: RootStore;
  children: ReactNode;
}) {
  return (
    <RootStoreContext.Provider value={props.store}>
      {props.children}
    </RootStoreContext.Provider>
  );
}

/**
 * Returns the RootStore from context. Components should usually call
 * the per-domain hooks (`useRouteStore`, `useCameraStore`, etc.)
 * instead — those compose this internally and give the consumer a
 * narrower surface to read.
 */
export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) {
    throw new Error('useRootStore must be used inside RootStoreProvider');
  }
  return store;
}

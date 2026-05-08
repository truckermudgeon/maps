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
 * Returns the RootStore from context. Prefer the per-domain hooks
 * (`useRouteStore`, `useCameraStore`, etc.) — they expose a narrower
 * surface.
 */
export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) {
    throw new Error('useRootStore must be used inside RootStoreProvider');
  }
  return store;
}

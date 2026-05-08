import { runInAction } from 'mobx';
import type { RootStore } from './stores/root-store';

declare global {
  interface Window {
    __DEV__?: DevTools;
  }
}

interface DevTools {
  readonly rootStore: RootStore;
  readonly runInAction: (fn: () => void) => void;
}

export function setupDevtools(opts: { rootStore: RootStore }) {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__DEV__ = {
    rootStore: opts.rootStore,
    runInAction: runInAction,
  };

  console.info('dev tools available at window.__DEV__');
}

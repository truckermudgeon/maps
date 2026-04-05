import { runInAction } from 'mobx';
import type { AppStore } from './controllers/types';

declare global {
  interface Window {
    __DEV__?: DevTools;
  }
}

interface DevTools {
  readonly appStore: AppStore;
  readonly runInAction: (fn: () => void) => void;
}

export function setupDevtools(opts: { appStore: AppStore }) {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__DEV__ = {
    appStore: opts.appStore,
    runInAction: runInAction,
  };

  console.info('dev tools available at window.__DEV__');
}

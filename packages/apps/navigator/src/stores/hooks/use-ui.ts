import { useRootStore } from '../context';
import type { MapPaddingStore, UIEnvironmentStore } from '../types';

export function useUIEnvironmentStore(): UIEnvironmentStore {
  return useRootStore().uiEnv;
}

export function useMapPaddingStore(): MapPaddingStore {
  return useRootStore().mapPadding;
}

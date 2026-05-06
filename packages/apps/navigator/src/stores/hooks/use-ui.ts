import type {
  MapPaddingStore,
  UIEnvironmentStore,
} from '../../controllers/types';
import { useRootStore } from '../context';

export function useUIEnvironmentStore(): UIEnvironmentStore {
  return useRootStore().uiEnv;
}

export function useMapPaddingStore(): MapPaddingStore {
  return useRootStore().mapPadding;
}

import { useRootStore } from '../context';
import type { ControlsStore } from '../types';

export function useControlsStore(): ControlsStore {
  return useRootStore().controls;
}

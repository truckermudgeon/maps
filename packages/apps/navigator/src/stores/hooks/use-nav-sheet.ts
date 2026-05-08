import { useRootStore } from '../context';
import type { NavSheetStore } from '../types';

export function useNavSheetStore(): NavSheetStore {
  return useRootStore().navSheet;
}

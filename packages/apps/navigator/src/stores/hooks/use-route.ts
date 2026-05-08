import { useRootStore } from '../context';
import type { RouteStore } from '../types';

export function useRouteStore(): RouteStore {
  return useRootStore().route;
}

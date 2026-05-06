import { useRootStore } from '../context';
import type { SessionStore } from '../types';

export function useSessionStore(): SessionStore {
  return useRootStore().session;
}

import { useRootStore } from '../context';
import type { CameraStore } from '../types';

export function useCameraStore(): CameraStore {
  return useRootStore().camera;
}

import type { CameraStoreImpl } from '../camera';
import { useRootStore } from '../context';

export function useCameraStore(): CameraStoreImpl {
  return useRootStore().camera;
}

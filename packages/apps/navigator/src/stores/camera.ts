import { makeAutoObservable } from 'mobx';
import type { CameraStore } from './types';

export const enum CameraMode {
  FOLLOW,
  FREE,
}

export const enum BearingMode {
  MATCH_MAP,
  NORTH_LOCK,
}

export class CameraStoreImpl implements CameraStore {
  cameraMode: CameraMode = CameraMode.FOLLOW;
  bearingMode: BearingMode = BearingMode.MATCH_MAP;

  constructor() {
    makeAutoObservable(this);
  }

  setFollow(): void {
    this.cameraMode = CameraMode.FOLLOW;
  }

  setFree(): void {
    this.cameraMode = CameraMode.FREE;
  }

  setNorthLock(): void {
    this.bearingMode = BearingMode.NORTH_LOCK;
  }

  setNorthUnlock(): void {
    this.bearingMode = BearingMode.MATCH_MAP;
  }
}

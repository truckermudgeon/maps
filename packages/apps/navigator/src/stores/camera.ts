import { makeAutoObservable } from 'mobx';
import type { CameraStore, NavSheetStore } from './types';

export const enum CameraMode {
  FOLLOW,
  FREE,
}

export const enum BearingMode {
  MATCH_MAP,
  NORTH_LOCK,
}

export class CameraStoreImpl implements CameraStore {
  // Tracks whether the user has manually detached the camera (e.g. by
  // dragging the map). `cameraMode` is derived from this plus the
  // navsheet's policy: certain pages force FREE for their duration.
  userDetached = false;
  bearingMode: BearingMode = BearingMode.MATCH_MAP;

  constructor(private readonly navSheet: NavSheetStore) {
    makeAutoObservable<this, 'navSheet'>(this, { navSheet: false });
  }

  get cameraMode(): CameraMode {
    return this.userDetached || this.navSheet.requiresFreeCamera
      ? CameraMode.FREE
      : CameraMode.FOLLOW;
  }

  setFollow(): void {
    this.userDetached = false;
  }

  setFree(): void {
    this.userDetached = true;
  }

  setNorthLock(): void {
    this.bearingMode = BearingMode.NORTH_LOCK;
  }

  setNorthUnlock(): void {
    this.bearingMode = BearingMode.MATCH_MAP;
  }
}

import { makeAutoObservable } from 'mobx';
import type {
  CameraStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from '../stores/types';
import { CameraMode } from './constants';
import type { ControlsStore } from './types';

export class ControlsStoreImpl implements ControlsStore {
  bearing = 0;
  limit = 0;
  speed = 0;

  constructor(
    private readonly session: SessionStore,
    private readonly camera: CameraStore,
    private readonly route: RouteStore,
    private readonly navSheet: NavSheetStore,
  ) {
    makeAutoObservable(this);
  }

  get units(): 'imperial' | 'metric' {
    return this.session.map === 'usa' ? 'imperial' : 'metric';
  }

  get showRecenterFab(): boolean {
    return this.camera.cameraMode === CameraMode.FREE;
  }

  get showRouteFab(): boolean {
    return !this.route.activeRoute && !this.navSheet.showNavSheet;
  }

  get showSearchFab(): boolean {
    return !!this.route.activeRoute && !this.navSheet.showNavSheet;
  }
}

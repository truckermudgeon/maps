import { action, makeAutoObservable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { CameraMode } from './camera';
import type {
  CameraStore,
  ControlsStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from './types';

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

/**
 * Wires the maplibre `move` event into `store.bearing` so the
 * compass UI tracks the map's heading. Called once from the map's
 * onLoad handler; the listener lives for the lifetime of the map.
 */
export function bindControlsToMap(map: MapRef, store: ControlsStore): void {
  map.on(
    'move',
    action(() => (store.bearing = map.getBearing())),
  );
}

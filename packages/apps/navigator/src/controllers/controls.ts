import { action, makeAutoObservable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { CameraMode } from './constants';
import type { AppStore, ControlsController, ControlsStore } from './types';

export class ControlsStoreImpl implements ControlsStore {
  bearing = 0;
  limit = 0;
  speed = 0;

  constructor(private readonly appStore: AppStore) {
    makeAutoObservable(this);
  }

  get units(): 'imperial' | 'metric' {
    return this.appStore.map === 'usa' ? 'imperial' : 'metric';
  }

  get showRecenterFab(): boolean {
    return this.appStore.cameraMode === CameraMode.FREE;
  }

  get showRouteFab(): boolean {
    return !this.appStore.activeRoute && !this.appStore.showNavSheet;
  }

  get showSearchFab(): boolean {
    return !!this.appStore.activeRoute && !this.appStore.showNavSheet;
  }
}

/**
 * Tracks the map bearing into ControlsStore on map move. Speed/limit
 * updates come from TelemetryService now (single subscription point);
 * this controller only owns the map.on('move') binding.
 */
export class ControlsControllerImpl implements ControlsController {
  private mapMoveSubscription: { unsubscribe: () => void } | undefined;

  onMapLoad(store: ControlsStore, map: MapRef) {
    this.mapMoveSubscription?.unsubscribe();
    this.mapMoveSubscription = map.on(
      'move',
      action(() => (store.bearing = map.getBearing())),
    );
  }
}

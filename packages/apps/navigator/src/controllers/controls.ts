import { action, makeAutoObservable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { CameraMode } from './constants';
import type {
  AppClient,
  AppStore,
  ControlsController,
  ControlsStore,
} from './types';

export class ControlsStoreImpl implements ControlsStore {
  bearing = 0;
  limitMph = 0;
  speedMph = 0;

  constructor(private readonly appStore: AppStore) {
    makeAutoObservable(this);
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

export class ControlsControllerImpl implements ControlsController {
  startListening(store: ControlsStore, appClient: AppClient, map: MapRef) {
    appClient.onPositionUpdate.subscribe(undefined, {
      onData: action(gameState => {
        const { speed } = gameState;
        const speedMph = Math.abs(Math.round(speed * 2.236936));
        store.limitMph = gameState.speedLimit;
        store.speedMph = speedMph;
      }),
    });
    map.on(
      'move',
      action(() => (store.bearing = map.getBearing())),
    );
  }
}

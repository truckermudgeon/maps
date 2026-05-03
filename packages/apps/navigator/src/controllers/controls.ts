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

export class ControlsControllerImpl implements ControlsController {
  private positionSubscription: { unsubscribe: () => void } | undefined;
  private mapMoveSubscription: { unsubscribe: () => void } | undefined;

  startListening(store: ControlsStore, appClient: AppClient, map: MapRef) {
    this.positionSubscription?.unsubscribe();
    this.mapMoveSubscription?.unsubscribe();

    this.positionSubscription = appClient.onPositionUpdate.subscribe(
      undefined,
      {
        onData: action(gameState => {
          const { speed } = gameState;
          if (store.units === 'imperial') {
            store.limit = gameState.speedLimit.mph;
            store.speed = Math.abs(Math.round(speed * 2.236936));
          } else {
            store.limit = gameState.speedLimit.kph;
            store.speed = Math.abs(Math.round(gameState.speed * 3.6));
          }
        }),
      },
    );
    this.mapMoveSubscription = map.on(
      'move',
      action(() => (store.bearing = map.getBearing())),
    );
  }
}

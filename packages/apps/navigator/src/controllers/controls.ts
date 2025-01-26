import { action, makeAutoObservable } from 'mobx';
import { toCompassPoint } from '../base/to-compass-point';
import { CameraMode } from './constants';
import type {
  AppClient,
  AppStore,
  CompassPoint,
  ControlsController,
  ControlsStore,
} from './types';

export class ControlsStoreImpl implements ControlsStore {
  direction: CompassPoint = 'N';
  limitMph = 0;

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
  startListening(store: ControlsStore, appClient: AppClient) {
    // TODO keep returned Unsubscribable
    appClient.onPositionUpdate.subscribe(undefined, {
      onData: action(gameState => {
        store.direction = toCompassPoint(gameState.bearing);
        store.limitMph = gameState.speedLimit;
      }),
    });
  }
}

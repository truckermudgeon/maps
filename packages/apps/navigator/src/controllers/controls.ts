import { action, makeAutoObservable } from 'mobx';
import { toCompassPoint } from '../base/to-compass-point';
import { CameraMode } from './constants';
import type {
  AppClient,
  AppStore,
  ControlsController,
  ControlsStore,
  Direction,
} from './types';

export class ControlsStoreImpl implements ControlsStore {
  direction: Direction = 'N';
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
  startListening(store: ControlsStore, socket: AppClient) {
    // TODO keep returned Unsubscribable
    socket.onPositionUpdate.subscribe(undefined, {
      onData: action(gameState => {
        store.direction = toCompassPoint(gameState.bearing);
        store.limitMph = gameState.speedLimit;
      }),
    });
  }
}

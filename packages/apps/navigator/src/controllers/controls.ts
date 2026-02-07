import { toPosAndBearing } from '@truckermudgeon/navigation/helpers';
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
  startListening(store: ControlsStore, appClient: AppClient) {
    appClient.onPositionUpdate.subscribe(undefined, {
      onData: action(gameState => {
        const { speed, position, heading } = gameState;
        const { bearing } = toPosAndBearing({
          position: {
            X: position.x,
            Y: position.z,
            Z: position.y,
          },
          orientation: {
            heading,
          },
        });
        const speedMph = Math.abs(Math.round(speed * 2.236936));
        store.direction = toCompassPoint(bearing);
        store.limitMph = gameState.speedLimit;
        store.speedMph = speedMph;
      }),
    });
  }
}

import { assert } from '@truckermudgeon/base/assert';
import { action, makeAutoObservable } from 'mobx';
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
        store.direction = toDirection(gameState.bearing);
        store.limitMph = gameState.speedLimit;
      }),
    });
  }
}

// TODO move this to a shared location
export function toDirection(bearing: number): Direction {
  const azimuth = bearing >= 0 ? bearing : 360 + bearing;
  if (337.5 <= azimuth || azimuth < 22.5) {
    return 'N';
  } else if (22.5 <= azimuth && azimuth < 67.5) {
    return 'NE';
  } else if (67.5 <= azimuth && azimuth < 112.5) {
    return 'E';
  } else if (112.5 <= azimuth && azimuth < 157.5) {
    return 'SE';
  } else if (157.5 <= azimuth && azimuth < 202.5) {
    return 'S';
  } else if (202.5 <= azimuth && azimuth < 247.5) {
    return 'SW';
  } else if (247.5 <= azimuth && azimuth < 292.5) {
    return 'W';
  } else {
    assert(292.5 <= azimuth && azimuth < 337.5);
    return 'NW';
  }
}

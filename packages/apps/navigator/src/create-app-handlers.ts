import { assertExists } from '@truckermudgeon/base/assert';
import { delay } from '@truckermudgeon/base/delay';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { RouteStep } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { AppControllerImpl } from './controllers/app';
import { BearingMode, CameraMode } from './controllers/constants';
import type {
  AppClient,
  AppStore,
  NavSheetController,
  NavSheetStore,
} from './controllers/types';
import { bearingAfterStepManeuver, routeCornerPair } from './route-bounds';

export interface HandlerDeps {
  store: AppStore;
  controller: AppControllerImpl;
  navSheetStore: NavSheetStore;
  navSheetController: NavSheetController;
  appClient: AppClient;
}

export interface NavSheetHandlerDeps extends HandlerDeps {
  hideNavSheet: () => void;
}

export interface HideNavSheetDeps
  extends Pick<
    HandlerDeps,
    'store' | 'controller' | 'navSheetStore' | 'navSheetController'
  > {
  transitionDurationMs: number;
}

export interface NavSheetCallbacks {
  onCloseClick: () => void;
  onDestinationGoClick: () => void;
  onRouteGoClick: () => void;
  onRouteToPointClick: () => void;
  onRouteStepClick: (step: RouteStep) => void;
  onWaypointsChange: (waypoints: bigint[]) => void;
}

export interface ControlsCallbacks {
  onCompassClick: () => void;
  onRecenterFabClick: () => void;
  onRouteFabClick: () => void;
  onSearchFabClick: () => void;
}

export interface RouteControlsCallbacks {
  onManageStops: () => void;
  onSearchAlongRoute: () => void;
  onRoutePreview: () => void;
  onRouteDirections: () => void;
  onRouteEnd: () => void;
}

export function buildHideNavSheet(deps: HideNavSheetDeps): () => void {
  const {
    store,
    controller,
    navSheetStore,
    navSheetController,
    transitionDurationMs,
  } = deps;
  return action(() => {
    controller.hideNavSheet(store);
    controller.setFollow(store);
    // Wait until nav sheet finishes transitioning away before resetting,
    // otherwise the nav sheet will flash the UI for the reset state.
    void delay(transitionDurationMs).then(
      action(() => navSheetController.reset(navSheetStore)),
    );
    // HACK but reset destinations list right away, because we want to hide
    // markers right away.
    navSheetStore.destinations = [];
    // HACK the reaction that's set up to draw step-arrows doesn't handle the
    // case where there's no active route, but a preview-step arrow has been
    // drawn. Handle it here.
    if (!store.activeRoute) {
      controller.drawStepArrow(undefined);
    }
  });
}

export function buildNavSheetHandlers(
  deps: NavSheetHandlerDeps,
): NavSheetCallbacks {
  const {
    store,
    controller,
    navSheetStore,
    navSheetController,
    appClient,
    hideNavSheet,
  } = deps;
  return {
    onCloseClick: hideNavSheet,
    onDestinationGoClick: () => {
      controller.setDestinationNodeUid(
        store,
        assertExists(navSheetStore.selectedDestination).nodeUid,
        appClient,
      );
      hideNavSheet();
    },
    onRouteGoClick: action(() => {
      controller.setActiveRoute(store, navSheetStore.selectedRoute, appClient);
      hideNavSheet();
    }),
    onRouteToPointClick: action(() => {
      navSheetStore.isLoading = true;
      controller.synthesizeSearchResult(store, appClient).then(
        action(searchResult => {
          navSheetController.onDestinationRoutesClick(
            navSheetStore,
            searchResult,
          );
        }),
        error => console.log('error trying to synthesize result', error),
      );
    }),
    onRouteStepClick: action(step => {
      controller.flyTo(
        store,
        step.maneuver.lonLat,
        bearingAfterStepManeuver(step),
      );
      controller.drawStepArrow(step);
    }),
    onWaypointsChange: action(waypoints => {
      controller.setActiveRouteFromNodeUids(store, waypoints, appClient);
    }),
  };
}

export function buildControlsHandlers(
  deps: Pick<
    HandlerDeps,
    'store' | 'controller' | 'navSheetStore' | 'navSheetController'
  >,
): ControlsCallbacks {
  const { store, controller, navSheetStore, navSheetController } = deps;
  return {
    onCompassClick: action(() => {
      controller.requestWakeLock();
      switch (store.bearingMode) {
        case BearingMode.MATCH_MAP:
          controller.setNorthLock(store);
          break;
        case BearingMode.NORTH_LOCK:
          controller.setNorthUnlock(store);
          break;
        default:
          throw new UnreachableError(store.bearingMode);
      }
    }),
    onRecenterFabClick: action(() => {
      controller.requestWakeLock();
      controller.setFollow(store);
    }),
    onRouteFabClick: action(() => {
      controller.requestWakeLock();
      navSheetController.startChooseDestinationFlow(navSheetStore);
      store.showNavSheet = true;
    }),
    onSearchFabClick: action(() => {
      controller.requestWakeLock();
      navSheetController.startSearchAlongFlow(navSheetStore);
      store.showNavSheet = true;
    }),
  };
}

export function buildRouteControlsHandlers(
  deps: HandlerDeps,
): RouteControlsCallbacks {
  const { store, controller, navSheetStore, navSheetController, appClient } =
    deps;
  return {
    onManageStops: action(() => {
      navSheetController.startManageStopsFlow(navSheetStore);
      store.showNavSheet = true;
    }),
    onSearchAlongRoute: action(() => {
      navSheetController.startSearchAlongFlow(navSheetStore);
      store.showNavSheet = true;
    }),
    onRoutePreview: action(() => {
      if (!store.activeRoute) {
        console.warn('no active route to preview');
        return;
      }
      store.cameraMode = CameraMode.FREE;
      controller.fitPoints(store, routeCornerPair(store.activeRoute));
    }),
    onRouteDirections: action(() => {
      navSheetController.startShowActiveRouteDirectionsFlow(navSheetStore);
      store.showNavSheet = true;
    }),
    onRouteEnd: action(() =>
      controller.setActiveRoute(store, undefined, appClient),
    ),
  };
}

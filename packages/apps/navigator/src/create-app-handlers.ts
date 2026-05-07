import { assertExists } from '@truckermudgeon/base/assert';
import { delay } from '@truckermudgeon/base/delay';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { RouteStep } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { AppControllerImpl } from './controllers/app';
import { BearingMode, CameraMode } from './controllers/constants';
import type { NavSheetController } from './controllers/types';
import type { MapPresenter } from './services/map-presenter';
import type { CameraStore, NavSheetStore, RouteStore } from './stores/types';
import { routeCornerPair } from './util/route-bounds';
import { bearingAfterStepManeuver } from './util/route-features';

export interface HandlerDeps {
  camera: CameraStore;
  route: RouteStore;
  controller: AppControllerImpl;
  mapPresenter: MapPresenter;
  navSheetStore: NavSheetStore;
  navSheetController: NavSheetController;
}

export interface NavSheetHandlerDeps extends HandlerDeps {
  hideNavSheet: () => void;
}

export interface HideNavSheetDeps
  extends Pick<
    HandlerDeps,
    | 'camera'
    | 'route'
    | 'controller'
    | 'mapPresenter'
    | 'navSheetStore'
    | 'navSheetController'
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
    camera,
    route,
    controller,
    mapPresenter,
    navSheetStore,
    transitionDurationMs,
  } = deps;
  return action(() => {
    controller.hideNavSheet();
    camera.setFollow();
    // Wait until nav sheet finishes transitioning away before resetting,
    // otherwise the nav sheet will flash the UI for the reset state.
    void delay(transitionDurationMs).then(
      action(() => deps.navSheetStore.reset()),
    );
    // HACK but reset destinations list right away, because we want to hide
    // markers right away.
    navSheetStore.destinations = [];
    // HACK the reaction that's set up to draw step-arrows doesn't handle the
    // case where there's no active route, but a preview-step arrow has been
    // drawn. Handle it here.
    if (!route.activeRoute) {
      mapPresenter.drawStepArrow(undefined);
    }
  });
}

export function buildNavSheetHandlers(
  deps: NavSheetHandlerDeps,
): NavSheetCallbacks {
  const {
    controller,
    mapPresenter,
    navSheetStore,
    navSheetController,
    hideNavSheet,
  } = deps;
  return {
    onCloseClick: hideNavSheet,
    onDestinationGoClick: () => {
      controller.setDestinationNodeUid(
        assertExists(navSheetStore.selectedDestination).nodeUid,
      );
      hideNavSheet();
    },
    onRouteGoClick: action(() => {
      controller.setActiveRoute(navSheetStore.selectedRoute);
      hideNavSheet();
    }),
    onRouteToPointClick: action(() => {
      navSheetStore.isLoading = true;
      controller.synthesizeSearchResult().then(
        action(searchResult => {
          navSheetController.onDestinationRoutesClick(searchResult);
        }),
        error => console.log('error trying to synthesize result', error),
      );
    }),
    onRouteStepClick: action(step => {
      mapPresenter.flyTo(step.maneuver.lonLat, bearingAfterStepManeuver(step));
      mapPresenter.drawStepArrow(step);
    }),
    onWaypointsChange: action(waypoints => {
      controller.setActiveRouteFromNodeUids(waypoints);
    }),
  };
}

export function buildControlsHandlers(
  deps: Pick<
    HandlerDeps,
    'camera' | 'controller' | 'navSheetStore' | 'navSheetController'
  >,
): ControlsCallbacks {
  const { camera, controller, navSheetStore } = deps;
  return {
    onCompassClick: action(() => {
      controller.requestWakeLock();
      switch (camera.bearingMode) {
        case BearingMode.MATCH_MAP:
          camera.setNorthLock();
          break;
        case BearingMode.NORTH_LOCK:
          camera.setNorthUnlock();
          break;
        default:
          throw new UnreachableError(camera.bearingMode);
      }
    }),
    onRecenterFabClick: action(() => {
      controller.requestWakeLock();
      camera.setFollow();
    }),
    onRouteFabClick: action(() => {
      controller.requestWakeLock();
      navSheetStore.startChooseDestinationFlow();
    }),
    onSearchFabClick: action(() => {
      controller.requestWakeLock();
      navSheetStore.startSearchAlongFlow();
    }),
  };
}

export function buildRouteControlsHandlers(
  deps: HandlerDeps,
): RouteControlsCallbacks {
  const { camera, route, controller, mapPresenter, navSheetStore } = deps;
  return {
    onManageStops: action(() => navSheetStore.startManageStopsFlow()),
    onSearchAlongRoute: action(() => navSheetStore.startSearchAlongFlow()),
    onRoutePreview: action(() => {
      if (!route.activeRoute) {
        console.warn('no active route to preview');
        return;
      }
      camera.cameraMode = CameraMode.FREE;
      mapPresenter.fitPoints(routeCornerPair(route.activeRoute));
    }),
    onRouteDirections: action(() =>
      navSheetStore.startShowActiveRouteDirectionsFlow(),
    ),
    onRouteEnd: action(() => controller.setActiveRoute(undefined)),
  };
}

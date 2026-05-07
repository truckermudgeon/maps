/* eslint-disable @typescript-eslint/unbound-method */
import polyline from '@mapbox/polyline';
import type {
  Route,
  RouteStep,
  SearchResult,
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import { vi } from 'vitest';
import type { AppControllerImpl } from '../controllers/app';
import { BearingMode, CameraMode } from '../controllers/constants';
import type {
  AppClient,
  NavSheetController,
  NavSheetStore,
} from '../controllers/types';
import {
  buildControlsHandlers,
  buildHideNavSheet,
  buildNavSheetHandlers,
  buildRouteControlsHandlers,
} from '../create-app-handlers';
import type { MapPresenter } from '../services/map-presenter';
import type { AppStore } from './util/types';

function makeStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    themeMode: 'light',
    map: 'usa',
    cameraMode: CameraMode.FOLLOW,
    bearingMode: BearingMode.MATCH_MAP,
    setFollow: vi.fn(),
    setFree: vi.fn(),
    setNorthLock: vi.fn(),
    setNorthUnlock: vi.fn(),
    truckPoint: [0, 0],
    trailerPoint: undefined,
    hasReceivedFirstTelemetry: false,
    readyToLoad: false,
    bindingStale: false,
    activeRoute: undefined,
    activeRouteIndex: undefined,
    activeRouteSummary: undefined,
    activeRouteToFirstWayPointSummary: undefined,
    segmentComplete: undefined,
    distanceToNextManeuver: 0,
    activeRouteDirection: undefined,
    activeStepLine: undefined,
    activeArrowStep: undefined,
    geoJsonRoute: { steps: [], featureLength: 0 },
    ...overrides,
  };
}

function makeNavSheetStore(
  overrides: Partial<NavSheetStore> = {},
): NavSheetStore {
  return {
    title: '',
    currentPageKey: 0 as never,
    showBackButton: false,
    pageStack: [],
    pushPage: vi.fn(),
    popPage: vi.fn(),
    replaceTopPage: vi.fn(),
    resetStack: vi.fn(),
    reset: vi.fn(),
    startChooseDestinationFlow: vi.fn(),
    startSearchAlongFlow: vi.fn(),
    startShowActiveRouteDirectionsFlow: vi.fn(),
    startManageStopsFlow: vi.fn(),
    highlightDestination: vi.fn(),
    selectDestination: vi.fn(),
    openChooseOnMap: vi.fn(),
    highlightRoute: vi.fn(),
    selectRoute: vi.fn(),
    showRouteDetails: vi.fn(),
    showNavSheet: false,
    isLoading: false,
    disableFitToBounds: false,
    searchQuery: '',
    destinations: [],
    selectedDestination: undefined,
    routes: [],
    selectedRoute: undefined,
    ...overrides,
  };
}

function makeController(): AppControllerImpl {
  return {
    hideNavSheet: vi.fn(),
    setDestinationNodeUid: vi.fn(),
    setActiveRoute: vi.fn(),
    setActiveRouteFromNodeUids: vi.fn(),
    requestWakeLock: vi.fn(),
    synthesizeSearchResult: vi.fn(),
  } as unknown as AppControllerImpl;
}

function makeMapPresenter(): MapPresenter {
  return {
    flyTo: vi.fn(),
    drawStepArrow: vi.fn(),
    fitPoints: vi.fn(),
  } as unknown as MapPresenter;
}

function makeNavSheetController(): NavSheetController {
  return {
    reset: vi.fn(),
    onDestinationRoutesClick: vi.fn(),
    startChooseDestinationFlow: vi.fn(),
    startSearchAlongFlow: vi.fn(),
    startManageStopsFlow: vi.fn(),
    startShowActiveRouteDirectionsFlow: vi.fn(),
  } as unknown as NavSheetController;
}

const fakeAppClient = {} as AppClient;

describe('buildHideNavSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides nav sheet, follows, and clears destinations immediately', () => {
    const store = makeStore();
    const navSheetStore = makeNavSheetStore({
      destinations: [{} as never, {} as never],
    });
    const controller = makeController();
    const mapPresenter = makeMapPresenter();
    const navSheetController = makeNavSheetController();

    const hide = buildHideNavSheet({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore,
      navSheetController,
      transitionDurationMs: 300,
    });

    hide();

    expect(controller.hideNavSheet).toHaveBeenCalledTimes(1);
    expect(store.setFollow).toHaveBeenCalledTimes(1);
    expect(navSheetStore.destinations).toEqual([]);
    // Reset has not yet been called — happens after transitionDurationMs.
    expect(navSheetStore.reset).not.toHaveBeenCalled();
  });

  it('resets navsheet only after transitionDurationMs elapses', async () => {
    const store = makeStore();
    const navSheetStore = makeNavSheetStore();
    const controller = makeController();
    const mapPresenter = makeMapPresenter();
    const navSheetController = makeNavSheetController();

    const hide = buildHideNavSheet({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore,
      navSheetController,
      transitionDurationMs: 300,
    });

    hide();
    expect(navSheetStore.reset).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(navSheetStore.reset).toHaveBeenCalledTimes(1);
  });

  it('clears step arrow when there is no active route', () => {
    const store = makeStore({ activeRoute: undefined });
    const controller = makeController();
    const mapPresenter = makeMapPresenter();

    const hide = buildHideNavSheet({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore: makeNavSheetStore(),
      navSheetController: makeNavSheetController(),
      transitionDurationMs: 0,
    });

    hide();

    expect(mapPresenter.drawStepArrow).toHaveBeenCalledWith(undefined);
  });

  it('does not clear step arrow when there is an active route', () => {
    const store = makeStore({ activeRoute: {} as Route });
    const controller = makeController();
    const mapPresenter = makeMapPresenter();

    const hide = buildHideNavSheet({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore: makeNavSheetStore(),
      navSheetController: makeNavSheetController(),
      transitionDurationMs: 0,
    });

    hide();

    expect(mapPresenter.drawStepArrow).not.toHaveBeenCalled();
  });
});

describe('buildNavSheetHandlers', () => {
  function setup(
    overrides: {
      store?: Partial<AppStore>;
      navSheetStore?: Partial<NavSheetStore>;
    } = {},
  ) {
    const store = makeStore(overrides.store);
    const navSheetStore = makeNavSheetStore(overrides.navSheetStore);
    const controller = makeController();
    const mapPresenter = makeMapPresenter();
    const navSheetController = makeNavSheetController();
    const hideNavSheet = vi.fn();
    const handlers = buildNavSheetHandlers({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore,
      navSheetController,
      hideNavSheet,
    });
    return {
      store,
      navSheetStore,
      controller,
      mapPresenter,
      navSheetController,
      hideNavSheet,
      handlers,
    };
  }

  it('onCloseClick calls hideNavSheet', () => {
    const { handlers, hideNavSheet } = setup();
    handlers.onCloseClick();
    expect(hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('onDestinationGoClick sets destination and hides', () => {
    const selectedDestination = { nodeUid: 'abc' } as SearchResult;
    const { handlers, controller, hideNavSheet } = setup({
      navSheetStore: { selectedDestination },
    });

    handlers.onDestinationGoClick();

    expect(controller.setDestinationNodeUid).toHaveBeenCalledWith('abc');
    expect(hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('onRouteGoClick activates selected route and hides', () => {
    const selectedRoute = { id: 'r1' } as Route;
    const { handlers, controller, hideNavSheet } = setup({
      navSheetStore: { selectedRoute },
    });

    handlers.onRouteGoClick();

    expect(controller.setActiveRoute).toHaveBeenCalledWith(selectedRoute);
    expect(hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('onRouteToPointClick sets isLoading and chains onDestinationRoutesClick', async () => {
    const searchResult = { nodeUid: 'sr' } as SearchResult;
    const { handlers, navSheetStore, controller, navSheetController } = setup();
    (
      controller.synthesizeSearchResult as ReturnType<typeof vi.fn>
    ).mockResolvedValue(searchResult);

    handlers.onRouteToPointClick();

    expect(navSheetStore.isLoading).toBe(true);
    await vi.waitFor(() =>
      expect(navSheetController.onDestinationRoutesClick).toHaveBeenCalledWith(
        searchResult,
      ),
    );
  });

  it('onRouteStepClick flies to maneuver and draws arrow', () => {
    const step: RouteStep = {
      maneuver: { lonLat: [10, 20] } as StepManeuver,
      geometry: polyline.encode([
        [0, 0],
        [1, 0],
      ]),
      distanceMeters: 0,
      duration: 0,
      nodesTraveled: 0,
      arrowPoints: 2,
      trafficIcons: [],
    };
    const { handlers, mapPresenter } = setup();

    handlers.onRouteStepClick(step);

    expect(mapPresenter.flyTo).toHaveBeenCalledWith(
      [10, 20],
      expect.any(Number),
    );
    expect(mapPresenter.drawStepArrow).toHaveBeenCalledWith(step);
  });

  it('onWaypointsChange forwards to setActiveRouteFromNodeUids', () => {
    const { handlers, controller } = setup();
    const waypoints = [1n, 2n];

    handlers.onWaypointsChange(waypoints);

    expect(controller.setActiveRouteFromNodeUids).toHaveBeenCalledWith(
      waypoints,
    );
  });
});

describe('buildControlsHandlers', () => {
  function setup(storeOverrides: Partial<AppStore> = {}) {
    const store = makeStore(storeOverrides);
    const navSheetStore = makeNavSheetStore();
    const controller = makeController();
    const navSheetController = makeNavSheetController();
    const handlers = buildControlsHandlers({
      camera: store,
      controller,
      navSheetStore,
      navSheetController,
    });
    return { store, navSheetStore, controller, navSheetController, handlers };
  }

  it.each([
    {
      name: 'MATCH_MAP → setNorthLock',
      mode: BearingMode.MATCH_MAP,
      expectedMethod: 'setNorthLock' as const,
    },
    {
      name: 'NORTH_LOCK → setNorthUnlock',
      mode: BearingMode.NORTH_LOCK,
      expectedMethod: 'setNorthUnlock' as const,
    },
  ])('onCompassClick: $name', ({ mode, expectedMethod }) => {
    const { handlers, controller, store } = setup({ bearingMode: mode });
    handlers.onCompassClick();
    expect(store[expectedMethod]).toHaveBeenCalledTimes(1);
    expect(controller.requestWakeLock).toHaveBeenCalledTimes(1);
  });

  it('onRecenterFabClick: requests wake lock and follows', () => {
    const { handlers, controller, store } = setup();
    handlers.onRecenterFabClick();
    expect(controller.requestWakeLock).toHaveBeenCalledTimes(1);
    expect(store.setFollow).toHaveBeenCalledTimes(1);
  });

  it('onRouteFabClick: starts choose destination flow', () => {
    const { handlers, navSheetStore } = setup();
    handlers.onRouteFabClick();
    expect(navSheetStore.startChooseDestinationFlow).toHaveBeenCalledTimes(1);
  });

  it('onSearchFabClick: starts search-along flow', () => {
    const { handlers, navSheetStore } = setup();
    handlers.onSearchFabClick();
    expect(navSheetStore.startSearchAlongFlow).toHaveBeenCalledTimes(1);
  });
});

describe('buildRouteControlsHandlers', () => {
  function setup(storeOverrides: Partial<AppStore> = {}) {
    const store = makeStore(storeOverrides);
    const navSheetStore = makeNavSheetStore();
    const controller = makeController();
    const mapPresenter = makeMapPresenter();
    const navSheetController = makeNavSheetController();
    const handlers = buildRouteControlsHandlers({
      camera: store,
      route: store,
      controller,
      mapPresenter,
      navSheetStore,
      navSheetController,
    });
    return {
      store,
      navSheetStore,
      controller,
      mapPresenter,
      navSheetController,
      handlers,
    };
  }

  it('onManageStops: starts manage-stops flow', () => {
    const { handlers, navSheetStore } = setup();
    handlers.onManageStops();
    expect(navSheetStore.startManageStopsFlow).toHaveBeenCalledTimes(1);
  });

  it('onRoutePreview: warns and noops when no active route', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { handlers, mapPresenter } = setup({ activeRoute: undefined });
    handlers.onRoutePreview();
    expect(warn).toHaveBeenCalled();
    expect(mapPresenter.fitPoints).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('onRoutePreview: sets free camera and fits points to active route', () => {
    const activeRoute = {
      id: 'r1',
      segments: [
        {
          steps: [
            {
              geometry: polyline.encode([
                [0, 0],
                [1, 1],
              ]),
              trafficIcons: [],
            },
          ],
        },
      ],
    } as unknown as Route;
    const { handlers, store, mapPresenter } = setup({ activeRoute });
    handlers.onRoutePreview();
    expect(store.cameraMode).toBe(CameraMode.FREE);
    expect(mapPresenter.fitPoints).toHaveBeenCalledTimes(1);
  });

  it('onRouteEnd: clears the active route', () => {
    const { handlers, controller } = setup();
    handlers.onRouteEnd();
    expect(controller.setActiveRoute).toHaveBeenCalledWith(undefined);
  });
});

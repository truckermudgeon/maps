/* eslint-disable @typescript-eslint/unbound-method */
import type {
  Route,
  RouteWithSummary,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import type { IReactionDisposer } from 'mobx';
import { observable, runInAction } from 'mobx';
import { vi } from 'vitest';
import { wireAppReactions } from '..';
import type { ChooseOnMapService } from '../../services/choose-on-map';
import type { MapAdapter } from '../../services/map-adapter';
import type { RouteRenderer } from '../../services/route-renderer';
import { CameraMode } from '../../stores/camera';
import { NavPageKey, NavSheetStoreImpl } from '../../stores/nav-sheet';
import type { MapPaddingStore } from '../../stores/types';
import type { AppStore } from './types';

function makeObservableStore(overrides: Partial<AppStore> = {}): AppStore {
  return observable<AppStore>(
    {
      themeMode: 'light',
      map: 'usa',
      cameraMode: CameraMode.FOLLOW,
      bearingMode: 0 as never,
      setFollow: vi.fn(),
      setFree: vi.fn(),
      setNorthLock: vi.fn(),
      setNorthUnlock: vi.fn(),
      truckPoint: [0, 0],
      trailerPoint: undefined,
      hasReceivedFirstTelemetry: false,
      isAuthenticated: false,
      bindingStale: false,
      telemetryStatus: 'awaiting',
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
    },
    undefined,
    { deep: false },
  );
}

function makeMapPaddingStore(): MapPaddingStore {
  return {
    padding: { left: 0, right: 0, top: 0, bottom: 0 },
    offset: [0, 0],
  };
}

function makeMapAdapter(): MapAdapter {
  return {
    setOffset: vi.fn(),
    setPadding: vi.fn(),
    clearPitchAndBearing: vi.fn(),
    fitPoints: vi.fn(),
  } as unknown as MapAdapter;
}

function makeChooseOnMapService(): ChooseOnMapService {
  return { toggle: vi.fn() } as unknown as ChooseOnMapService;
}

function makeRouteRenderer(): RouteRenderer {
  return {
    renderRoutePreview: vi.fn(),
    renderActiveRoute: vi.fn(),
    drawStepArrow: vi.fn(),
  } as unknown as RouteRenderer;
}

interface Setup {
  store: AppStore;
  mapAdapter: MapAdapter;
  chooseOnMapService: ChooseOnMapService;
  routeRenderer: RouteRenderer;
  navSheetStore: NavSheetStoreImpl;
  mapPaddingStore: MapPaddingStore;
  disposers: IReactionDisposer[];
}

function setup(storeOverrides: Partial<AppStore> = {}): Setup {
  const store = makeObservableStore(storeOverrides);
  const mapAdapter = makeMapAdapter();
  const chooseOnMapService = makeChooseOnMapService();
  const routeRenderer = makeRouteRenderer();
  const navSheetStore = new NavSheetStoreImpl();
  const mapPaddingStore = makeMapPaddingStore();
  const disposers = wireAppReactions({
    camera: store,
    route: store,
    mapAdapter,
    chooseOnMapService,
    routeRenderer,
    navSheetStore,
    mapPaddingStore,
  });
  return {
    store,
    mapAdapter,
    chooseOnMapService,
    routeRenderer,
    navSheetStore,
    mapPaddingStore,
    disposers,
  };
}

function teardown(s: Setup) {
  s.disposers.forEach(d => d());
}

describe('wireAppReactions', () => {
  describe('autorun for map padding/offset', () => {
    it('calls setOffset and setPadding immediately on wire-up', () => {
      const s = setup();
      expect(s.mapAdapter.setOffset).toHaveBeenCalledWith([0, 0]);
      expect(s.mapAdapter.setPadding).toHaveBeenCalledWith({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      });
      teardown(s);
    });
  });

  describe('choose-on-map reaction', () => {
    it('toggles choose-on-map UI on when navsheet shows CHOOSE_ON_MAP page', () => {
      const s = setup();
      runInAction(() => {
        s.navSheetStore.showNavSheet = true;
        s.navSheetStore.pushPage(NavPageKey.CHOOSE_ON_MAP);
      });

      expect(s.chooseOnMapService.toggle).toHaveBeenCalledWith(true);
      expect(s.mapAdapter.clearPitchAndBearing).toHaveBeenCalled();
      expect(s.store.cameraMode).toBe(CameraMode.FREE);
      teardown(s);
    });

    it('toggles choose-on-map UI off when leaving the page', () => {
      const s = setup();
      runInAction(() => {
        s.navSheetStore.showNavSheet = true;
        s.navSheetStore.pushPage(NavPageKey.CHOOSE_ON_MAP);
      });
      (s.chooseOnMapService.toggle as ReturnType<typeof vi.fn>).mockClear();

      runInAction(() => {
        s.navSheetStore.popPage();
      });

      expect(s.chooseOnMapService.toggle).toHaveBeenCalledWith(false);
      teardown(s);
    });
  });

  describe('destinations fit reaction', () => {
    it('fits camera to destination points when navsheet is on DESTINATIONS', () => {
      const s = setup();
      const dest1 = { lonLat: [-100, 40] } as SearchResultWithRelativeTruckInfo;
      const dest2 = { lonLat: [-90, 35] } as SearchResultWithRelativeTruckInfo;
      runInAction(() => {
        s.navSheetStore.pushPage(NavPageKey.DESTINATIONS);
        s.navSheetStore.destinations = [dest1, dest2];
      });

      expect(s.store.setFree).toHaveBeenCalled();
      expect(s.mapAdapter.fitPoints).toHaveBeenCalledWith([
        [-100, 40],
        [-90, 35],
      ]);
      teardown(s);
    });

    it('does not fit when disableFitToBounds is true', () => {
      const s = setup();
      runInAction(() => {
        s.navSheetStore.pushPage(NavPageKey.DESTINATIONS);
        s.navSheetStore.disableFitToBounds = true;
        s.navSheetStore.destinations = [
          { lonLat: [0, 0] } as SearchResultWithRelativeTruckInfo,
        ];
      });

      expect(s.mapAdapter.fitPoints).not.toHaveBeenCalled();
      teardown(s);
    });
  });

  describe('route-preview ordering reaction', () => {
    it('renders previews with the highlighted route on top (last layer)', () => {
      const s = setup();
      const r0 = { id: 'r0' } as RouteWithSummary;
      const r1 = { id: 'r1' } as RouteWithSummary;
      const r2 = { id: 'r2' } as RouteWithSummary;
      runInAction(() => {
        s.navSheetStore.routes = [r0, r1, r2];
        s.navSheetStore.selectedRoute = r1 as unknown as Route;
      });

      const calls = (
        s.routeRenderer.renderRoutePreview as ReturnType<typeof vi.fn>
      ).mock.calls;
      // Last 3 calls are the most recent reaction firing.
      const recent = calls.slice(-3);
      expect(recent[0]).toEqual([r0, expect.objectContaining({ index: 0 })]);
      expect(recent[1]).toEqual([r2, expect.objectContaining({ index: 1 })]);
      expect(recent[2]).toEqual([
        r1,
        expect.objectContaining({ index: 2, highlight: true }),
      ]);
      teardown(s);
    });

    it('restores active route render when routes list becomes empty and selection is undefined', () => {
      const activeRoute = { id: 'active' } as unknown as Route;
      const s = setup({ activeRoute });
      runInAction(() => {
        s.navSheetStore.routes = [{ id: 'r0' } as RouteWithSummary];
      });
      (
        s.routeRenderer.renderActiveRoute as ReturnType<typeof vi.fn>
      ).mockClear();

      runInAction(() => {
        s.navSheetStore.routes = [];
        s.navSheetStore.selectedRoute = undefined;
      });

      expect(s.routeRenderer.renderActiveRoute).toHaveBeenCalledWith(
        activeRoute,
      );
      teardown(s);
    });
  });
});

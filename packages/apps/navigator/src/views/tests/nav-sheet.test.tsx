/* eslint-disable @typescript-eslint/unbound-method */
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  Route,
  RouteWithSummary,
  SearchResult,
} from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import type { AppControllerImpl } from '../../controllers/app';
import { NavPageKey } from '../../controllers/constants';
import { NavSheetControllerImpl } from '../../controllers/nav-sheet';
import type { NavSheetController } from '../../controllers/types';
import { useHideNavSheet } from '../../services/context';
import type { MapAdapter } from '../../services/map-adapter';
import type { RouteApi } from '../../services/route-api';
import type { RouteRenderer } from '../../services/route-renderer';
import type { SearchApi } from '../../services/search-api';
import { CameraStoreImpl } from '../../stores/camera';
import { NavSheetStoreImpl } from '../../stores/nav-sheet';
import { RouteStoreImpl } from '../../stores/route';
import { SessionStoreImpl } from '../../stores/session';
import { NavSheet } from '../NavSheet';
import { renderWithApp } from './_helpers/render-with-app';

const fakeRouteApi = {} as RouteApi;
const fakeSearchApi = {} as SearchApi;
const fakeMapAdapter = {} as MapAdapter;

function setupStores() {
  return {
    session: new SessionStoreImpl('usa'),
    camera: new CameraStoreImpl(),
    route: new RouteStoreImpl(),
    navSheet: new NavSheetStoreImpl(),
  };
}

// ---------- useHideNavSheet hook (covers buildHideNavSheet behaviors) ----------

let capturedHide: (() => void) | undefined;
function HideRig() {
  capturedHide = useHideNavSheet();
  return null;
}

function callHide() {
  act(() => capturedHide!());
}

describe('useHideNavSheet', () => {
  beforeEach(() => {
    capturedHide = undefined;
  });

  it('hides nav sheet, sets follow, and clears destinations immediately', () => {
    const stores = setupStores();
    runInAction(() => {
      stores.navSheet.destinations = [
        { nodeUid: 'a' } as never,
        { nodeUid: 'b' } as never,
      ];
    });
    const setFollow = vi.spyOn(stores.camera, 'setFollow');
    const controller = {
      hideNavSheet: vi.fn(),
    } as unknown as AppControllerImpl;
    renderWithApp(<HideRig />, {
      stores,
      services: { controller, transitionDurationMs: 300 },
    });

    callHide();

    expect(controller.hideNavSheet).toHaveBeenCalledTimes(1);
    expect(setFollow).toHaveBeenCalledTimes(1);
    expect(stores.navSheet.destinations).toEqual([]);
  });

  it('resets navsheet only after transitionDurationMs elapses', async () => {
    vi.useFakeTimers();
    try {
      const stores = setupStores();
      const reset = vi.spyOn(stores.navSheet, 'reset');
      renderWithApp(<HideRig />, {
        stores,
        services: { transitionDurationMs: 300 },
      });

      callHide();
      expect(reset).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      expect(reset).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the step arrow when there is no active route', () => {
    const stores = setupStores();
    const routeRenderer = {
      drawStepArrow: vi.fn(),
    } as unknown as RouteRenderer;
    renderWithApp(<HideRig />, {
      stores,
      services: { routeRenderer, transitionDurationMs: 0 },
    });

    callHide();

    expect(routeRenderer.drawStepArrow).toHaveBeenCalledWith(undefined);
  });

  it('does not clear the step arrow when there is an active route', () => {
    const stores = setupStores();
    runInAction(() => {
      stores.route.activeRoute = { id: 'r' } as Route;
    });
    const routeRenderer = {
      drawStepArrow: vi.fn(),
    } as unknown as RouteRenderer;
    renderWithApp(<HideRig />, {
      stores,
      services: { routeRenderer, transitionDurationMs: 0 },
    });

    callHide();

    expect(routeRenderer.drawStepArrow).not.toHaveBeenCalled();
  });
});

// ---------- NavSheet UI flows (covers buildNavSheetHandlers behaviors) ----------

function makeFakeDestination(): SearchResult {
  return {
    nodeUid: 'abc',
    label: 'Foo',
    type: 'company',
    sprite: 'fake_sprite',
    facilityUrls: [],
    city: { name: 'Sacramento', stateCode: 'CA', distance: 0 },
    lonLat: [0, 0],
    distance: 0,
    bearing: 0,
  } as unknown as SearchResult;
}

function makeFakeRoute(): RouteWithSummary {
  return {
    id: 'r1',
    distanceMeters: 1000,
    duration: 600,
    segments: [{ strategy: 'shortest', key: 'a-b', steps: [] }],
    summary: { distanceMeters: 1000, minutes: 10, grades: [], roads: [] },
  } as unknown as RouteWithSummary;
}

function renderNavSheet(opts: {
  stores: ReturnType<typeof setupStores>;
  controller?: AppControllerImpl;
  navSheetControllerOverride?: Partial<NavSheetController>;
  transitionDurationMs?: number;
}) {
  const { stores, controller, transitionDurationMs = 0 } = opts;
  const navSheetController = new NavSheetControllerImpl(
    stores.navSheet,
    fakeRouteApi,
    fakeSearchApi,
    fakeMapAdapter,
  );
  if (opts.navSheetControllerOverride) {
    Object.assign(navSheetController, opts.navSheetControllerOverride);
  }
  return {
    ...renderWithApp(<NavSheet />, {
      stores,
      services: {
        ...(controller ? { controller } : {}),
        navSheetController,
        transitionDurationMs,
      },
    }),
    navSheetController,
  };
}

describe('NavSheet (view) — handler flows', () => {
  it('close button → hides nav sheet (orchestration via useHideNavSheet)', async () => {
    const stores = setupStores();
    const controller = {
      hideNavSheet: vi.fn(),
    } as unknown as AppControllerImpl;
    const user = userEvent.setup();
    renderNavSheet({ stores, controller });

    const closeIcon = screen.getByTestId('CloseIcon');
    await user.click(closeIcon.closest('button')!);

    expect(controller.hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('destination "Go!" → setDestinationNodeUid + hides', async () => {
    const stores = setupStores();
    const dest = makeFakeDestination();
    runInAction(() => {
      stores.navSheet.destinations = [dest as never];
      stores.navSheet.selectedDestination = dest;
      stores.navSheet.resetStack(NavPageKey.DESTINATIONS);
    });
    const controller = {
      hideNavSheet: vi.fn(),
      setDestinationNodeUid: vi.fn(),
    } as unknown as AppControllerImpl;
    const user = userEvent.setup();
    renderNavSheet({ stores, controller });

    await user.click(screen.getByRole('button', { name: /^go!$/i }));

    expect(controller.setDestinationNodeUid).toHaveBeenCalledWith('abc');
    expect(controller.hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('route "Go!" → setActiveRoute + hides', async () => {
    const stores = setupStores();
    const fakeRoute = makeFakeRoute();
    runInAction(() => {
      stores.navSheet.selectedDestination = makeFakeDestination();
      stores.navSheet.routes = [fakeRoute];
      stores.navSheet.resetStack(NavPageKey.ROUTES);
    });
    const controller = {
      hideNavSheet: vi.fn(),
      setActiveRoute: vi.fn(),
    } as unknown as AppControllerImpl;
    const user = userEvent.setup();
    renderNavSheet({ stores, controller });

    await user.click(screen.getByRole('button', { name: /^go!$/i }));

    expect(controller.setActiveRoute).toHaveBeenCalledTimes(1);
    expect(controller.setActiveRoute).toHaveBeenCalledWith(fakeRoute);
    expect(controller.hideNavSheet).toHaveBeenCalledTimes(1);
  });

  it('"Done" on choose-on-map → sets isLoading + chains onDestinationRoutesClick(searchResult)', async () => {
    const stores = setupStores();
    runInAction(() => {
      stores.navSheet.resetStack(NavPageKey.CHOOSE_ON_MAP);
    });
    const synthResult = makeFakeDestination();
    const controller = {
      synthesizeSearchResult: vi.fn().mockResolvedValue(synthResult),
    } as unknown as AppControllerImpl;
    const onDestinationRoutesClick = vi.fn();
    const user = userEvent.setup();
    renderNavSheet({
      stores,
      controller,
      navSheetControllerOverride: { onDestinationRoutesClick },
    });

    await user.click(screen.getByRole('button', { name: /^done$/i }));

    expect(stores.navSheet.isLoading).toBe(true);
    await vi.waitFor(() =>
      expect(onDestinationRoutesClick).toHaveBeenCalledWith(synthResult),
    );
  });

  // TODO onRouteStepClick (DIRECTIONS_FROM_ROUTES_LIST step click → mapAdapter.flyTo +
  // routeRenderer.drawStepArrow) and onWaypointsChange (MANAGE_STOPS reorder/delete →
  // controller.setActiveRouteFromNodeUids) are mechanical inlines that need
  // heavy stub data (LaneIcons, dnd-kit interactions). Cover via integration
  // testing, not here.
});

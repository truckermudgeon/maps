import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import type { AppControllerImpl } from '../../controllers/app';
import type { NavSheetController } from '../../controllers/types';
import { ServicesProvider, type AppServices } from '../../services/context';
import type { MapAdapter } from '../../services/map-adapter';
import type { RouteRenderer } from '../../services/route-renderer';
import { CameraStoreImpl } from '../../stores/camera';
import { RootStoreProvider } from '../../stores/context';
import { MapPaddingStoreImpl } from '../../stores/map-padding';
import { NavSheetStoreImpl } from '../../stores/nav-sheet';
import { RootStore } from '../../stores/root-store';
import { RouteStoreImpl } from '../../stores/route';
import { SessionStoreImpl } from '../../stores/session';
import type {
  Breakpoints,
  CameraStore,
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
  UIEnvironmentStore,
} from '../../stores/types';
import { UiEnvironmentStoreImpl } from '../../stores/ui-environment';

const defaultBreakpoints: Breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

/**
 * Default no-op AppController stub. Methods grow as views start
 * calling them via `useAppController`. Tests override individual
 * methods (or the whole controller) via `services.controller`.
 */
function defaultFakeController(): AppControllerImpl {
  return {
    unpauseRouteEvents: vi.fn(),
    setActiveRoute: vi.fn(),
  } as unknown as AppControllerImpl;
}

export interface RenderWithAppOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Override individual stores. Any store not provided gets a default
   * impl (matching the production composition). Use this to seed
   * specific state, or to swap in a mock implementing the interface.
   */
  stores?: {
    session?: SessionStore;
    camera?: CameraStore;
    route?: RouteStore;
    navSheet?: NavSheetStore;
    uiEnv?: UIEnvironmentStore;
    mapPadding?: MapPaddingStore;
  };
  /**
   * Override individual services. Any service not provided gets a
   * default `vi.fn()`-based no-op stub. Use this to assert on
   * service-method calls triggered by view interactions.
   */
  services?: Partial<AppServices>;
}

export interface RenderWithAppResult extends RenderResult {
  rootStore: RootStore;
  services: AppServices;
}

/**
 * Renders `ui` inside `RootStoreProvider` + `ServicesProvider`. Use
 * to test view components that read stores via `useRouteStore` etc.
 * and services via `useAppController` etc.
 *
 * The returned `rootStore` and `services` are the same instances the
 * rendered tree sees. Mutate the stores (inside `act()` if needed)
 * to drive observer re-renders, or assert on service-method spies
 * triggered by user interaction.
 */
export function renderWithApp(
  ui: ReactElement,
  options: RenderWithAppOptions = {},
): RenderWithAppResult {
  const { stores, services: serviceOverrides, ...renderOptions } = options;
  const session = stores?.session ?? new SessionStoreImpl('usa');
  const camera = stores?.camera ?? new CameraStoreImpl();
  const route = stores?.route ?? new RouteStoreImpl();
  const navSheet = stores?.navSheet ?? new NavSheetStoreImpl();
  const uiEnv = stores?.uiEnv ?? new UiEnvironmentStoreImpl(defaultBreakpoints);
  const mapPadding =
    stores?.mapPadding ??
    new MapPaddingStoreImpl(uiEnv, route, camera, navSheet);
  const rootStore = new RootStore({
    session,
    camera,
    route,
    navSheet,
    uiEnv,
    mapPadding,
  });
  const services: AppServices = {
    controller: serviceOverrides?.controller ?? defaultFakeController(),
    mapAdapter: serviceOverrides?.mapAdapter ?? ({} as MapAdapter),
    routeRenderer: serviceOverrides?.routeRenderer ?? ({} as RouteRenderer),
    navSheetController:
      serviceOverrides?.navSheetController ?? ({} as NavSheetController),
    transitionDurationMs: serviceOverrides?.transitionDurationMs ?? 0,
  };
  const result = render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <RootStoreProvider store={rootStore}>
        <ServicesProvider services={services}>{children}</ServicesProvider>
      </RootStoreProvider>
    ),
  });
  return { ...result, rootStore, services };
}

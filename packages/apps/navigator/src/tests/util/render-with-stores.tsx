import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement } from 'react';
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

export interface RenderWithStoresOptions
  extends Omit<RenderOptions, 'wrapper'> {
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
}

export interface RenderWithStoresResult extends RenderResult {
  rootStore: RootStore;
}

/**
 * Renders `ui` inside a `RootStoreProvider` backed by the real store
 * impls. Use to test view components that read from `useRouteStore`,
 * `useNavSheetStore`, etc.
 *
 * The returned `rootStore` is the same instance the rendered tree
 * sees — mutate it (inside `act()` if needed) to drive observer
 * re-renders during a test.
 */
export function renderWithStores(
  ui: ReactElement,
  options: RenderWithStoresOptions = {},
): RenderWithStoresResult {
  const { stores, ...renderOptions } = options;
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
  const result = render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <RootStoreProvider store={rootStore}>{children}</RootStoreProvider>
    ),
  });
  return { ...result, rootStore };
}

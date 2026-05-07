import { delay } from '@truckermudgeon/base/delay';
import { action } from 'mobx';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import type { AppController, NavSheetController } from '../controllers/types';
import { useCameraStore } from '../stores/hooks/use-camera';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { useRouteStore } from '../stores/hooks/use-route';
import type { MapCamera } from './map';
import type { RouteRenderer } from './route-renderer';

/**
 * The non-store dependencies a view tree needs: the orchestrator
 * (`AppController`), the map/route side-effect services, and a few
 * config values that don't belong on a store. Construction lives in
 * `createApp`; views read individual entries via the per-service
 * hooks below.
 */
export interface AppServices {
  controller: AppController;
  mapCamera: MapCamera;
  routeRenderer: RouteRenderer;
  navSheetController: NavSheetController;
  transitionDurationMs: number;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider(props: {
  services: AppServices;
  children: ReactNode;
}) {
  return (
    <ServicesContext.Provider value={props.services}>
      {props.children}
    </ServicesContext.Provider>
  );
}

function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('useServices must be used inside ServicesProvider');
  }
  return services;
}

export function useAppController(): AppController {
  return useServices().controller;
}

export function useMapCamera(): MapCamera {
  return useServices().mapCamera;
}

export function useRouteRenderer(): RouteRenderer {
  return useServices().routeRenderer;
}

export function useNavSheetController(): NavSheetController {
  return useServices().navSheetController;
}

export function useTransitionDurationMs(): number {
  return useServices().transitionDurationMs;
}

/**
 * Returns a stable closure that hides the nav sheet and resets
 * orchestration state. Mirrors the pre-#5 `buildHideNavSheet`:
 * tells the controller to hide, returns the camera to follow mode,
 * waits for the transition before resetting the navsheet stack,
 * clears the destinations list immediately, and clears the
 * step-arrow when there's no active route.
 */
export function useHideNavSheet(): () => void {
  const camera = useCameraStore();
  const route = useRouteStore();
  const navSheetStore = useNavSheetStore();
  const routeRenderer = useRouteRenderer();
  const transitionDurationMs = useTransitionDurationMs();

  return useCallback(
    action(() => {
      navSheetStore.hide();
      camera.setFollow();
      void delay(transitionDurationMs).then(
        action(() => navSheetStore.reset()),
      );
      navSheetStore.destinations = [];
      if (!route.activeRoute) {
        routeRenderer.drawStepArrow(undefined);
      }
    }),
    [camera, route, navSheetStore, routeRenderer, transitionDurationMs],
  );
}

import { createContext, useContext, type ReactNode } from 'react';
import type { AppControllerImpl } from '../controllers/app';
import type { NavSheetController } from '../controllers/types';
import type { MapAdapter } from './map-adapter';
import type { RouteRenderer } from './route-renderer';

/**
 * The non-store dependencies a view tree needs: the orchestrator
 * (`AppController`), the map/route side-effect services, and a few
 * config values that don't belong on a store. Construction lives in
 * `createApp`; views read individual entries via the per-service
 * hooks below.
 */
export interface AppServices {
  controller: AppControllerImpl;
  mapAdapter: MapAdapter;
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

export function useAppController(): AppControllerImpl {
  return useServices().controller;
}

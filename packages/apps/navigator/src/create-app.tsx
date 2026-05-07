import type { Theme } from '@mui/joy';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { when } from 'mobx';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { AppControllerImpl } from './controllers/app';
import { NavSheetControllerImpl } from './controllers/nav-sheet';
import type { AppClient } from './controllers/types';
import { setupDevtools } from './dev-tools';
import { wireAppReactions } from './reactions';
import { applyThemeReaction } from './reactions/theme';
import { ChooseOnMapService } from './services/choose-on-map';
import { ServicesProvider } from './services/context';
import { MapAdapter } from './services/map-adapter';
import { RouteAnimator } from './services/route-animator';
import { RouteApiImpl } from './services/route-api';
import { RouteRenderer } from './services/route-renderer';
import { SearchApiImpl } from './services/search-api';
import { TelemetryService } from './services/telemetry';
import { CameraStoreImpl } from './stores/camera';
import { RootStoreProvider } from './stores/context';
import { bindControlsToMap, ControlsStoreImpl } from './stores/controls';
import { MapPaddingStoreImpl } from './stores/map-padding';
import { NavSheetStoreImpl } from './stores/nav-sheet';
import { RootStore } from './stores/root-store';
import { RouteStoreImpl } from './stores/route';
import { SessionStoreImpl } from './stores/session';
import { UiEnvironmentStoreImpl } from './stores/ui-environment';
import { AppLayout } from './views/AppLayout';

export function createApp({
  map,
  appClient,
  joyTheme,
  transitionDurationMs,
}: {
  map: 'usa' | 'europe';
  appClient: AppClient;
  joyTheme: Theme;
  transitionDurationMs: number;
}): {
  App: () => ReactElement;
  store: { isAuthenticated: boolean };
} {
  const session = new SessionStoreImpl(map);
  const navSheetStore = new NavSheetStoreImpl();
  const camera = new CameraStoreImpl(navSheetStore);
  const route = new RouteStoreImpl();
  const mapAdapter = new MapAdapter();
  const routeRenderer = new RouteRenderer(mapAdapter);
  const chooseOnMapService = new ChooseOnMapService(mapAdapter);
  const routeApi = new RouteApiImpl(appClient);
  const searchApi = new SearchApiImpl(appClient);
  const controlsStore = new ControlsStoreImpl(
    session,
    camera,
    route,
    navSheetStore,
  );
  const telemetryService = new TelemetryService(
    session,
    route,
    controlsStore,
    appClient,
  );
  const routeAnimator = new RouteAnimator(
    mapAdapter,
    routeRenderer,
    telemetryService.timeline,
  );
  const controller = new AppControllerImpl(
    camera,
    route,
    navSheetStore,
    routeRenderer,
    chooseOnMapService,
    routeApi,
    telemetryService,
    routeAnimator,
  );
  applyThemeReaction(session);

  const navSheetController = new NavSheetControllerImpl(
    navSheetStore,
    routeApi,
    searchApi,
    mapAdapter,
  );

  const uiEnv = new UiEnvironmentStoreImpl(joyTheme.breakpoints.values);
  const mapPaddingStore = new MapPaddingStoreImpl(
    uiEnv,
    route,
    camera,
    navSheetStore,
  );
  const rootStore = new RootStore({
    session,
    camera,
    route,
    navSheet: navSheetStore,
    controls: controlsStore,
    uiEnv,
    mapPadding: mapPaddingStore,
  });
  setupDevtools({ rootStore });
  // TODO these reactions are hacks while figuring out a better way to
  // structure stores and controllers.
  wireAppReactions({
    camera,
    route,
    mapAdapter,
    chooseOnMapService,
    routeRenderer,
    navSheetStore,
    mapPaddingStore,
  });

  when(
    () => session.isAuthenticated,
    () => {
      console.log('isAuthenticated signal received.');
      controller.startListening();
    },
  );

  const onMapLoad = (map: MapRef, marker: MapLibreGLMarker) => {
    mapAdapter.onMapLoad(map, marker);
    bindControlsToMap(map, controlsStore);
  };

  // Hoisted out of App() render fn so the context value reference
  // is stable — otherwise every render produces a new services
  // object and forces every `useAppController` consumer to re-render.
  const services = {
    controller,
    mapAdapter,
    routeRenderer,
    navSheetController,
    transitionDurationMs,
  };

  return {
    App: () => (
      <RootStoreProvider store={rootStore}>
        <ServicesProvider services={services}>
          <AppLayout
            initialMap={map}
            onMapLoad={onMapLoad}
            transitionDurationMs={transitionDurationMs}
          />
        </ServicesProvider>
      </RootStoreProvider>
    ),
    store: session,
  };
}

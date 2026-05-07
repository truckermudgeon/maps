import type { Theme } from '@mui/joy';
import { Box } from '@mui/joy';
import { Grid, Slide, useMediaQuery, useTheme } from '@mui/material';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computed, when } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { SpriteProvider } from './components/SpriteProvider';
import { AppControllerImpl } from './controllers/app';
import {
  maxPortraitSheetCssHeight,
  navSheetPagesRequiringMapVisibility,
} from './controllers/constants';
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
import { useNavSheetStore } from './stores/hooks/use-nav-sheet';
import { useRouteStore } from './stores/hooks/use-route';
import { MapPaddingStoreImpl } from './stores/map-padding';
import { NavSheetStoreImpl } from './stores/nav-sheet';
import { RootStore } from './stores/root-store';
import { RouteStoreImpl } from './stores/route';
import { SessionStoreImpl } from './stores/session';
import { UiEnvironmentStoreImpl } from './stores/ui-environment';
import { Controls } from './views/Controls';
import { NavSheet } from './views/NavSheet';
import { RouteStack } from './views/RouteStack';
import { SlippyMap } from './views/SlippyMap';
import { WaitingForTelemetry } from './views/WaitingForTelemetry';

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
  store: { readyToLoad: boolean };
} {
  const session = new SessionStoreImpl(map);
  const camera = new CameraStoreImpl();
  const route = new RouteStoreImpl();
  const navSheetStore = new NavSheetStoreImpl();
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
    routeRenderer,
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
    () => session.readyToLoad,
    () => {
      console.log('readyToLoad signal received.');
      controller.startListening();
    },
  );

  const onMapLoad = (map: MapRef, marker: MapLibreGLMarker) => {
    mapAdapter.onMapLoad(map, marker);
    bindControlsToMap(map, controlsStore);
  };

  // Hoisted out of the App() render fn so the lambda identity is
  // stable across renders — otherwise React sees a new component
  // type each render and remounts the SlippyMap subtree. Same
  // reasoning applies to the `services` object below.
  const _SlippyMap = () => <SlippyMap initialMap={map} onMapLoad={onMapLoad} />;

  // Hoisted out of the App() render fn so the context value reference
  // is stable — otherwise every App render produces a new services
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
          <App
            transitionDurationMs={transitionDurationMs}
            SlippyMap={_SlippyMap}
            NavSheet={NavSheet}
            RouteStack={RouteStack}
            Controls={Controls}
            WaitingForTelemetry={WaitingForTelemetry}
          />
        </ServicesProvider>
      </RootStoreProvider>
    ),
    store: session,
  };
}

const App = observer(
  (props: {
    transitionDurationMs: number;
    SlippyMap: () => ReactElement;
    NavSheet: () => ReactElement;
    RouteStack: () => ReactElement;
    Controls: () => ReactElement;
    WaitingForTelemetry: () => ReactElement;
  }) => {
    console.log('render app');
    const { SlippyMap, NavSheet, RouteStack, Controls, WaitingForTelemetry } =
      props;
    const navSheetStore = useNavSheetStore();
    const theme = useTheme();
    const isLargePortrait = useMediaQuery(
      theme.breakpoints.up('sm') + ' and (orientation: portrait)',
    );
    const isMapVisibilityRequired = computed(
      () =>
        navSheetStore.showNavSheet &&
        navSheetPagesRequiringMapVisibility.has(navSheetStore.currentPageKey),
    );

    return (
      <SpriteProvider>
        <SlippyMap />
        <Grid
          columns={3}
          container={true}
          sx={{
            flexGrow: 1,
            position: 'absolute',
            top: 0,
            right: 0,
            pointerEvents: 'none',
          }}
          padding={2}
          paddingBlockEnd={3}
          height={'100dvh'}
        >
          <HudStackGridItem
            isLargePortrait={isLargePortrait}
            transitionDurationMs={props.transitionDurationMs}
          >
            <Controls />
          </HudStackGridItem>
        </Grid>
        <Grid
          container={true}
          sx={{
            flexGrow: 1,
            pointerEvents: 'none',
          }}
          padding={2}
          paddingBlockEnd={3}
          height={'100dvh'}
          justifyContent={'space-between'}
        >
          <Grid
            size={{ xs: 12, sm: isLargePortrait ? 12 : 5 }}
            maxWidth={isLargePortrait ? undefined : 600}
            sx={{
              zIndex: 999, // so it renders over hud stack
            }}
          >
            <RouteStackContainer>
              <RouteStack />
            </RouteStackContainer>
          </Grid>
        </Grid>
        <Grid
          container={true}
          sx={{
            flexGrow: 1,
            position: 'absolute',
            ...(isMapVisibilityRequired.get() ? { bottom: 0 } : { top: 0 }),
            left: 0,
            right: 0,
            pointerEvents: 'none',
            p: {
              xs: 0,
              sm: 2,
            },
            height: {
              xs: isMapVisibilityRequired.get() ? 'fit-content' : '100dvh',
              sm:
                isMapVisibilityRequired.get() && isLargePortrait
                  ? 'fit-content'
                  : '100dvh',
            },
            maxHeight: {
              xs: isMapVisibilityRequired.get()
                ? maxPortraitSheetCssHeight
                : '100dvh',
              sm:
                isMapVisibilityRequired.get() && isLargePortrait
                  ? maxPortraitSheetCssHeight
                  : '100dvh',
            },
            overflow: 'auto',
          }}
          padding={2}
          paddingBlockEnd={3}
        >
          <Grid
            size={{ xs: 12, sm: isLargePortrait ? 12 : 5 }}
            maxWidth={isLargePortrait ? undefined : 600}
            sx={{
              maxHeight: {
                xs: isMapVisibilityRequired.get()
                  ? maxPortraitSheetCssHeight
                  : '100%',
                sm:
                  isMapVisibilityRequired.get() && isLargePortrait
                    ? maxPortraitSheetCssHeight
                    : '100%',
              },
            }}
          >
            <NavSheetContainer>
              <NavSheet />
            </NavSheetContainer>
          </Grid>
        </Grid>
        <WaitingForTelemetry />
      </SpriteProvider>
    );
  },
);

const HudStackGridItem = observer(
  (props: {
    transitionDurationMs: number;
    isLargePortrait: boolean;
    children: ReactElement;
  }) => {
    const navSheetStore = useNavSheetStore();
    const routeStore = useRouteStore();
    const showRouteStack = computed(
      () => !navSheetStore.showNavSheet && routeStore.activeRoute != null,
    );
    const portraitPt = computed(() => {
      if (!showRouteStack.get()) {
        return 0;
      }
      const dirHasLabel = routeStore.activeRouteDirection?.banner?.text != null;
      return dirHasLabel ? 18 : 14;
    });
    const portraitPb = computed(() => (showRouteStack.get() ? 13 : 0));
    return (
      <Grid
        container
        alignItems={'stretch'}
        sx={{
          // apply top/bottom padding for portrait orientations, so that hud
          // controls don't overlap route controls.
          pt: {
            xs: portraitPt.get(),
            sm: props.isLargePortrait ? portraitPt.get() : 0,
          },
          pb: {
            xs: portraitPb.get(),
            sm: props.isLargePortrait ? portraitPb.get() : 0,
          },
          zIndex: 999, // needed so it's drawn over any highlighted destination map markers.
          transition: `${props.transitionDurationMs}ms padding ease`,
        }}
      >
        {props.children}
      </Grid>
    );
  },
);

const RouteStackContainer = observer((props: { children: ReactElement }) => {
  const navSheetStore = useNavSheetStore();
  const routeStore = useRouteStore();
  return (
    <Slide
      in={!navSheetStore.showNavSheet && routeStore.activeRoute != null}
      direction={'right'}
    >
      <Box height={'100%'}>{props.children}</Box>
    </Slide>
  );
});

const NavSheetContainer = observer((props: { children: ReactElement }) => {
  const navSheetStore = useNavSheetStore();
  return (
    <Slide in={navSheetStore.showNavSheet} direction={'right'}>
      <Box
        height={'100%'}
        sx={{
          position: 'relative',
          top: 0,
          left: 0,
          zIndex: 999, // needed so it's drawn over any highlighted destination map markers.
          pointerEvents: 'auto',
        }}
      >
        {props.children}
      </Box>
    </Slide>
  );
});

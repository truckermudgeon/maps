import type { Theme } from '@mui/joy';
import { Box } from '@mui/joy';
import { Grid, Slide, useMediaQuery, useTheme } from '@mui/material';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { action, comparer, computed, when } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { AnimatedDirections } from './components/AnimatedDirections';
import { DestinationMarkers } from './components/DestinationMarkers';
import { PlayerMarker } from './components/PlayerMarker';
import { RouteControls } from './components/RouteControls';
import { RouteStack } from './components/RouteStack';
import { SegmentCompleteToast } from './components/SegmentCompleteToast';
import { SlippyMap } from './components/SlippyMap';
import { SpriteProvider } from './components/SpriteProvider';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from './components/text';
import { TrailerOrWaypointMarkers } from './components/TrailerOrWaypointMarkers';
import {
  WaitingForTelemetry,
  type WaitingForTelemetryState,
} from './components/WaitingForTelemetry';
import { AppControllerImpl, AppStoreImpl } from './controllers/app';
import {
  maxPortraitSheetCssHeight,
  NavPageKey,
  navSheetPagesRequiringMapVisibility,
} from './controllers/constants';
import type { AppClient, AppStore, NavSheetStore } from './controllers/types';
import {
  buildControlsHandlers,
  buildHideNavSheet,
  buildNavSheetHandlers,
  buildRouteControlsHandlers,
} from './create-app-handlers';
import { wireAppReactions } from './create-app-reactions';
import { createControls } from './create-controls';
import { createNavSheet } from './create-nav-sheet';
import { setupDevtools } from './dev-tools';
import { applyThemeReaction } from './reactions/theme';
import { toRouteSummary } from './route-display';
import { RootStoreProvider } from './stores/context';
import { useNavSheetStore } from './stores/hooks/use-nav-sheet';
import { MapPaddingStoreImpl } from './stores/map-padding';
import { NavSheetStoreImpl } from './stores/nav-sheet';
import { RootStore } from './stores/root-store';
import { UiEnvironmentStoreImpl } from './stores/ui-environment';

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
  store: Pick<AppStore, 'readyToLoad'>;
} {
  const store = new AppStoreImpl(map);
  const navSheetStore = new NavSheetStoreImpl();
  const controller = new AppControllerImpl(
    store.session,
    store.camera,
    store.route,
    navSheetStore,
    appClient,
  );
  applyThemeReaction(store.session);
  setupDevtools({ appStore: store });

  const { NavSheet, controller: navSheetController } = createNavSheet({
    appClient,
    appStore: store,
    appController: controller,
    store: navSheetStore,
  });
  const hideNavSheet = buildHideNavSheet({
    route: store.route,
    controller,
    navSheetStore,
    navSheetController,
    transitionDurationMs,
  });
  const navSheetCallbacks = buildNavSheetHandlers({
    camera: store.camera,
    route: store.route,
    controller,
    navSheetStore,
    navSheetController,
    hideNavSheet,
  });
  const _NavSheet = () => <NavSheet {...navSheetCallbacks} />;

  const uiEnv = new UiEnvironmentStoreImpl(joyTheme.breakpoints.values);
  const mapPaddingStore = new MapPaddingStoreImpl(
    uiEnv,
    store.route,
    store.camera,
    navSheetStore,
  );
  const rootStore = new RootStore({
    appStore: store,
    navSheet: navSheetStore,
    uiEnv,
    mapPadding: mapPaddingStore,
  });
  // TODO these reactions are hacks while figuring out a better way to
  // structure stores and controllers.
  wireAppReactions({
    camera: store.camera,
    route: store.route,
    controller,
    navSheetStore,
    mapPaddingStore,
  });

  const {
    Controls,
    controller: controlsController,
    store: controlsStore,
  } = createControls({
    session: store.session,
    camera: store.camera,
    route: store.route,
    navSheet: navSheetStore,
  });
  const controlsCallbacks = buildControlsHandlers({
    camera: store.camera,
    controller,
    navSheetStore,
    navSheetController,
  });
  const _Controls = () => <Controls {...controlsCallbacks} />;

  when(
    () => store.readyToLoad,
    () => {
      console.log('readyToLoad signal received.');
      controller.startListening(controlsStore);
    },
  );

  const onMapLoad = (map: MapRef, marker: MapLibreGLMarker) => {
    controller.onMapLoad(map, marker);
    controlsController.onMapLoad(controlsStore, map);
  };
  const _Destinations = observer(() => (
    <DestinationMarkers
      destinations={navSheetStore.destinations}
      selectedDestinationNodeUid={navSheetStore.selectedDestination?.nodeUid}
      forceDisplay={navSheetStore.currentPageKey === NavPageKey.DESTINATIONS}
      onDestinationClick={action(dest =>
        navSheetController.onDestinationRoutesClick(dest),
      )}
    />
  ));
  const tp = computed(
    () =>
      store.trailerPoint?.map(n => Number(n.toFixed(6))) as
        | [number, number]
        | undefined,
    { equals: comparer.structural },
  );
  const _TrailerOrWaypointMarkers = observer(() => {
    return (
      <TrailerOrWaypointMarkers
        trailerPoint={tp.get()}
        activeRoute={store.activeRoute}
      />
    );
  });
  const _SlippyMap = observer(() => {
    const _map = store.hasReceivedFirstTelemetry ? store.map : map;
    return (
      <SlippyMap
        key={_map}
        map={_map}
        mode={store.themeMode}
        onLoad={onMapLoad}
        onDragStart={action(() => controller.setFree())}
        Destinations={_Destinations}
        TrailerOrWaypointMarkers={_TrailerOrWaypointMarkers}
        PlayerMarker={PlayerMarker}
      />
    );
  });

  const _Directions = observer(() => (
    <AnimatedDirections
      direction={store.activeRouteDirection}
      distanceToNextManeuver={store.distanceToNextManeuver}
      units={store.map === 'usa' ? 'imperial' : 'metric'}
    />
  ));
  const _SegmentCompleteToast = observer(() =>
    store.segmentComplete != null ? (
      <SegmentCompleteToast
        open={true}
        place={store.segmentComplete.place}
        placeInfo={store.segmentComplete.placeInfo}
        isFinalSegment={store.segmentComplete.isFinal}
        onContinueClick={action(() => controller.unpauseRouteEvents())}
        onEndClick={action(() => {
          controller.unpauseRouteEvents();
          controller.setActiveRoute(undefined);
        })}
      />
    ) : (
      <></>
    ),
  );

  const routeSummary = computed(
    () =>
      toRouteSummary(
        store.activeRouteToFirstWayPointSummary,
        store.map === 'usa' ? defaultImperialOptions : defaultMetricOptions,
      ),
    { equals: comparer.structural },
  );

  const routeControlsCallbacks = buildRouteControlsHandlers({
    camera: store.camera,
    route: store.route,
    controller,
    navSheetStore,
    navSheetController,
  });
  const _RouteControls = observer(
    (props: { onExpandedToggle: (expanded: boolean) => void }) => (
      <RouteControls
        summary={routeSummary.get()}
        onExpandedToggle={props.onExpandedToggle}
        onManageStopsClick={
          store.activeRoute != null && store.activeRoute.segments.length > 1
            ? routeControlsCallbacks.onManageStops
            : undefined
        }
        onSearchAlongRouteClick={routeControlsCallbacks.onSearchAlongRoute}
        onRoutePreviewClick={routeControlsCallbacks.onRoutePreview}
        onRouteDirectionsClick={routeControlsCallbacks.onRouteDirections}
        onRouteEndClick={routeControlsCallbacks.onRouteEnd}
      />
    ),
  );

  const _RouteStack = () => (
    <RouteStack
      Guidance={_Directions}
      RouteControls={_RouteControls}
      SegmentCompleteToast={_SegmentCompleteToast}
    />
  );

  const _WaitingForTelemetry = observer(() => {
    if (!store.readyToLoad) {
      // assume some other component will show "waiting to load" UI
      return <></>;
    }
    // TODO show "Loading map..." UI if map hasn't loaded yet, instead of
    //  showing "Waiting for telemetry..." UI.
    if (store.hasReceivedFirstTelemetry && !store.bindingStale) {
      return <></>;
    }
    const state: WaitingForTelemetryState = !store.hasReceivedFirstTelemetry
      ? store.bindingStale
        ? 'orphaned'
        : 'awaiting'
      : 'lost';
    return (
      <WaitingForTelemetry
        state={state}
        onRePair={() => controller.forceRePair()}
      />
    );
  });

  return {
    App: () => (
      <RootStoreProvider store={rootStore}>
        <App
          store={store}
          navSheetStore={navSheetStore}
          transitionDurationMs={transitionDurationMs}
          SlippyMap={_SlippyMap}
          NavSheet={_NavSheet}
          RouteStack={_RouteStack}
          Controls={_Controls}
          WaitingForTelemetry={_WaitingForTelemetry}
        />
      </RootStoreProvider>
    ),
    store,
  };
}

const App = observer(
  (props: {
    store: AppStore;
    navSheetStore: NavSheetStore;
    transitionDurationMs: number;
    SlippyMap: () => ReactElement;
    NavSheet: () => ReactElement;
    RouteStack: () => ReactElement;
    Controls: () => ReactElement;
    WaitingForTelemetry: () => ReactElement;
  }) => {
    console.log('render app');
    const {
      store,
      navSheetStore,
      SlippyMap,
      NavSheet,
      RouteStack,
      Controls,
      WaitingForTelemetry,
    } = props;
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
            store={props.store}
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
            <RouteStackContainer store={props.store}>
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
    store: AppStore;
    transitionDurationMs: number;
    isLargePortrait: boolean;
    children: ReactElement;
  }) => {
    const navSheetStore = useNavSheetStore();
    const showRouteStack = computed(
      () => !navSheetStore.showNavSheet && props.store.activeRoute != null,
    );
    const portraitPt = computed(() => {
      if (!showRouteStack.get()) {
        return 0;
      }
      const dirHasLabel =
        props.store.activeRouteDirection?.banner?.text != null;
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

const RouteStackContainer = observer(
  (props: { store: AppStore; children: ReactElement }) => {
    const navSheetStore = useNavSheetStore();
    return (
      <Slide
        in={!navSheetStore.showNavSheet && props.store.activeRoute != null}
        direction={'right'}
      >
        <Box height={'100%'}>{props.children}</Box>
      </Slide>
    );
  },
);

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

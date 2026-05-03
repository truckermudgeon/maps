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
import { TelemetryLostToast } from './components/TelemetryLostToast';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from './components/text';
import { TrailerOrWaypointMarkers } from './components/TrailerOrWaypointMarkers';
import { WaitingForTelemetry } from './components/WaitingForTelemetry';
import { AppControllerImpl, AppStoreImpl } from './controllers/app';
import {
  maxPortraitSheetCssHeight,
  NavPageKey,
  navSheetPagesRequiringMapVisibility,
} from './controllers/constants';
import { MapPaddingStoreImpl } from './controllers/map-padding';
import type { AppClient, AppStore, NavSheetStore } from './controllers/types';
import { UiEnvironmentStoreImpl } from './controllers/ui-environment';
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
import { toRouteSummary } from './route-display';

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
  const controller = new AppControllerImpl();
  setupDevtools({ appStore: store });

  const {
    NavSheet,
    controller: navSheetController,
    store: navSheetStore,
  } = createNavSheet({ appClient, appStore: store, appController: controller });
  const hideNavSheet = buildHideNavSheet({
    store,
    controller,
    navSheetStore,
    navSheetController,
    transitionDurationMs,
  });
  const navSheetCallbacks = buildNavSheetHandlers({
    store,
    controller,
    navSheetStore,
    navSheetController,
    appClient,
    hideNavSheet,
  });
  const _NavSheet = () => <NavSheet {...navSheetCallbacks} />;

  const mapPaddingStore = new MapPaddingStoreImpl(
    new UiEnvironmentStoreImpl(joyTheme.breakpoints.values),
    store,
    navSheetStore,
  );
  // TODO these reactions are hacks while figuring out a better way to
  // structure stores and controllers.
  wireAppReactions({ store, controller, navSheetStore, mapPaddingStore });

  const {
    Controls,
    controller: controlsController,
    store: controlsStore,
  } = createControls({
    appStore: store,
  });
  const controlsCallbacks = buildControlsHandlers({
    store,
    controller,
    navSheetStore,
    navSheetController,
  });
  const _Controls = () => <Controls {...controlsCallbacks} />;

  const onMapLoad = (map: MapRef, marker: MapLibreGLMarker) => {
    console.log('waiting for readyToLoad signal');
    when(
      () => store.readyToLoad,
      () => {
        console.log('readyToLoad signal received.');
        store.mapLoaded = true;
        controller.onMapLoad(map, marker);
        controller.startListening(store, appClient);
        controlsController.startListening(controlsStore, appClient, map);
      },
    );
  };
  const _Destinations = observer(() => (
    <DestinationMarkers
      destinations={navSheetStore.destinations}
      selectedDestinationNodeUid={navSheetStore.selectedDestination?.nodeUid}
      forceDisplay={navSheetStore.currentPageKey === NavPageKey.DESTINATIONS}
      onDestinationClick={action(dest =>
        navSheetController.onDestinationRoutesClick(navSheetStore, dest),
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
        onDragStart={action(() => controller.setFree(store))}
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
        onContinueClick={action(() =>
          controller.unpauseRouteEvents(store, appClient),
        )}
        onEndClick={action(() => {
          controller.unpauseRouteEvents(store, appClient);
          controller.setActiveRoute(store, undefined, appClient);
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
    store,
    controller,
    navSheetStore,
    navSheetController,
    appClient,
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
    // Mid-session staleness (bindingStale after first sample) is surfaced
    // by TelemetryLostToast; this overlay is only for the pre-first-sample
    // case.
    return !store.hasReceivedFirstTelemetry ? (
      <WaitingForTelemetry
        bindingStale={store.bindingStale}
        onRePair={() => controller.forceRePair()}
      />
    ) : (
      <></>
    );
  });

  const _TelemetryLostToast = observer(() => (
    <TelemetryLostToast
      open={store.hasReceivedFirstTelemetry && store.bindingStale}
      onRePair={() => controller.forceRePair()}
    />
  ));

  return {
    App: () => (
      <App
        store={store}
        navSheetStore={navSheetStore}
        transitionDurationMs={transitionDurationMs}
        SlippyMap={_SlippyMap}
        NavSheet={_NavSheet}
        RouteStack={_RouteStack}
        Controls={_Controls}
        WaitingForTelemetry={_WaitingForTelemetry}
        TelemetryLostToast={_TelemetryLostToast}
      />
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
    TelemetryLostToast: () => ReactElement;
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
      TelemetryLostToast,
    } = props;
    const theme = useTheme();
    const isLargePortrait = useMediaQuery(
      theme.breakpoints.up('sm') + ' and (orientation: portrait)',
    );
    const isMapVisibilityRequired = computed(
      () =>
        store.showNavSheet &&
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
            <NavSheetContainer store={props.store}>
              <NavSheet />
            </NavSheetContainer>
          </Grid>
        </Grid>
        <WaitingForTelemetry />
        <TelemetryLostToast />
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
    const showRouteStack = computed(
      () => !props.store.showNavSheet && props.store.activeRoute != null,
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
    return (
      <Slide
        in={!props.store.showNavSheet && props.store.activeRoute != null}
        direction={'right'}
      >
        <Box height={'100%'}>{props.children}</Box>
      </Slide>
    );
  },
);

const NavSheetContainer = observer(
  (props: { store: AppStore; children: ReactElement }) => (
    <Slide in={props.store.showNavSheet} direction={'right'}>
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
  ),
);

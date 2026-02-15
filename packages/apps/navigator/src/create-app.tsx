import polyline from '@mapbox/polyline';
import { Box } from '@mui/joy';
import { Grid, Slide, useMediaQuery, useTheme } from '@mui/material';
import { assertExists } from '@truckermudgeon/base/assert';
import type { RouteStep } from '@truckermudgeon/navigation/types';
import { bbox } from '@turf/bbox';
import bearing from '@turf/bearing';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { action, comparer, computed, reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { DestinationMarkers } from './components/DestinationMarkers';
import { Directions } from './components/Directions';
import { PlayerMarker } from './components/PlayerMarker';
import { RouteControls } from './components/RouteControls';
import { RouteStack } from './components/RouteStack';
import { SegmentCompleteToast } from './components/SegmentCompleteToast';
import { SlippyMap } from './components/SlippyMap';
import { SpriteProvider } from './components/SpriteProvider';
import { toLengthAndUnit } from './components/text';
import { TrailerOrWaypointMarkers } from './components/TrailerOrWaypointMarkers';
import { WaitingForTelemetry } from './components/WaitingForTelemetry';
import {
  AppControllerImpl,
  AppStoreImpl,
  toFeatureCollection,
} from './controllers/app';
import { CameraMode, NavPageKey } from './controllers/constants';
import type { AppClient, AppStore } from './controllers/types';
import { createControls } from './create-controls';
import { createNavSheet } from './create-nav-sheet';

export function createApp({
  appClient,
  transitionDurationMs,
}: {
  appClient: AppClient;
  transitionDurationMs: number;
}) {
  const store = new AppStoreImpl();
  const controller = new AppControllerImpl();
  controller.setupWakeLock();

  const {
    NavSheet,
    controller: navSheetController,
    store: navSheetStore,
  } = createNavSheet({ appClient, appStore: store, appController: controller });
  const hideNavSheet = action(() => {
    controller.hideNavSheet(store);
    controller.setFollow(store);
    // Wait until nav sheet finishes transitioning away before resetting,
    // otherwise the nav sheet will flash the UI for the reset state.
    void delay(transitionDurationMs).then(
      action(() => navSheetController.reset(navSheetStore)),
    );
    // HACK but reset destinations list right away, because we want to hide
    // markers right away.
    navSheetStore.destinations = [];
  });
  const _NavSheet = () => (
    <NavSheet
      onCloseClick={hideNavSheet}
      onDestinationGoClick={() => {
        controller.setDestinationNodeUid(
          store,
          assertExists(navSheetStore.selectedDestination).nodeUid,
          appClient,
        );
        hideNavSheet();
      }}
      onRouteGoClick={action(() => {
        controller.setActiveRoute(
          store,
          navSheetStore.selectedRoute,
          appClient,
        );
        hideNavSheet();
      })}
      onRouteToPointClick={action(() => {
        navSheetStore.isLoading = true;
        controller.synthesizeSearchResult(store, appClient).then(
          action(searchResult => {
            navSheetController.onDestinationRoutesClick(
              navSheetStore,
              searchResult,
            );
          }),
          error => console.log('error trying to synthesize result', error),
        );
      })}
      onRouteStepClick={action(step => {
        controller.flyTo(
          store,
          step.maneuver.lonLat,
          bearingAfterStepManeuver(step),
        );
        controller.drawStepArrow(step);
      })}
      onWaypointsChange={action(waypoints => {
        controller.setActiveRouteFromNodeUids(store, waypoints, appClient);
      })}
    />
  );

  // TODO remove these reactions.
  // they're hacks while i figure out a better way to structure stores and controllers.
  reaction(
    () =>
      store.showNavSheet &&
      navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
    action(isChoosingOnMap => {
      controller.toggleChooseOnMapUi(store, isChoosingOnMap);
      if (isChoosingOnMap) {
        controller.clearPitchAndBearing(store);
        store.cameraMode = CameraMode.FREE;
      }
    }),
  );
  //reaction(
  //  () => navSheetStore.destinations.length > 0,
  //  hasDestinations =>
  //    // camera mode should probably be a computed. the only thing writeable
  //    // should be a "force Free" flag that gets set upon user gesture, and
  //    // cleared upon re-center click.
  //    (store.cameraMode = hasDestinations
  //      ? CameraMode.FREE
  //      : CameraMode.FOLLOW),
  //);
  reaction(
    () => {
      if (
        navSheetStore.destinations.length === 0 ||
        navSheetStore.currentPageKey !== NavPageKey.DESTINATIONS
      ) {
        return undefined;
      }
      return navSheetStore.destinations.map(destination => destination.lonLat);
    },
    action(maybeLonLats => {
      if (maybeLonLats) {
        controller.setFree(store);
        if (!navSheetStore.disableFitToBounds) {
          controller.fitPoints(store, maybeLonLats);
        }
      }
    }),
  );
  reaction(
    () => {
      if (
        store.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.ROUTES &&
        !navSheetStore.isLoading
      ) {
        return navSheetStore.routes;
      } else {
        return undefined;
      }
    },
    maybeRoutes => {
      if (!maybeRoutes) {
        return;
      }
      if (maybeRoutes.every(route => route.detour)) {
        const tlbrs = [store.truckPoint, maybeRoutes[0].detour!.lngLat];
        console.log('tlbrs', tlbrs);
        store.cameraMode = CameraMode.FREE;
        controller.fitPoints(store, tlbrs);
      } else {
        // TODO move this calc to RouteSummary
        const bboxes = maybeRoutes.map(route =>
          bbox(toFeatureCollection(route)),
        );
        const tlbrs = bboxes.flatMap(
          ([minX, minY, maxX, maxY]) =>
            [
              [minX, minY],
              [maxX, maxY],
            ] as [number, number][],
        );
        console.log('tlbrs', tlbrs);
        store.cameraMode = CameraMode.FREE;
        controller.fitPoints(store, tlbrs);
      }
    },
  );
  // render calls can be made directly by nav sheet controller.
  reaction(
    () => ({
      routes: navSheetStore.routes,
      selected: navSheetStore.selectedRoute,
    }),
    ({ routes, selected }) => {
      // HACK to make sure existing previews are cleared after navsheet reset
      [0, 1, 2].forEach(index =>
        controller.renderRoutePreview(routes[index], {
          index: index,
          highlight: selected?.id === routes[index]?.id,
        }),
      );
      if (routes.length === 0 && !selected) {
        // assume a navsheet reset happened. restore active route.
        controller.renderActiveRoute(store.activeRoute);
      }
    },
  );
  reaction(
    () =>
      store.showNavSheet &&
      navSheetStore.currentPageKey === NavPageKey.MANAGE_STOPS
        ? store.activeRoute
        : undefined,
    maybeRoute => {
      if (!maybeRoute) {
        return;
      }
      const [minX, minY, maxX, maxY] = bbox(toFeatureCollection(maybeRoute));
      const tlbr: [number, number][] = [
        [minX, minY],
        [maxX, maxY],
      ];
      store.cameraMode = CameraMode.FREE;
      controller.fitPoints(store, tlbr);
    },
  );
  reaction(
    () => (store.showNavSheet ? undefined : store.activeArrowStep),
    step => controller.drawStepArrow(step),
  );

  const {
    Controls,
    controller: controlsController,
    store: controlsStore,
  } = createControls({
    appStore: store,
  });
  const _Controls = () => (
    <Controls
      onRecenterFabClick={action(() => controller.setFollow(store))}
      onRouteFabClick={action(() => {
        navSheetController.startChooseDestinationFlow(navSheetStore);
        store.showNavSheet = true;
      })}
      onSearchFabClick={action(() => {
        navSheetController.startSearchAlongFlow(navSheetStore);
        store.showNavSheet = true;
      })}
    />
  );

  const onMapLoad = action((map: MapRef, marker?: MapLibreGLMarker) => {
    controller.onMapLoad(map, marker);
    controller.startListening(store, appClient);
    controlsController.startListening(controlsStore, appClient);
  });
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
  const _SlippyMap = observer(() => (
    <SlippyMap
      mode={store.themeMode}
      onLoad={onMapLoad}
      onDragStart={action(() => controller.setFree(store))}
      Destinations={_Destinations}
      TrailerOrWaypointMarkers={_TrailerOrWaypointMarkers}
      PlayerMarker={PlayerMarker}
    />
  ));

  const lengthAndUnitToNextManeuver = computed(() =>
    toLengthAndUnit(store.distanceToNextManeuver),
  );
  const _Directions = observer(() =>
    store.activeRouteDirection ? (
      <Directions
        direction={store.activeRouteDirection.direction}
        length={lengthAndUnitToNextManeuver.get().length}
        unit={lengthAndUnitToNextManeuver.get().unit}
        laneHint={
          store.distanceToNextManeuver <= 5_000
            ? store.activeRouteDirection.laneHint
            : undefined
        }
        thenHint={
          !store.activeRouteDirection.laneHint ||
          store.distanceToNextManeuver > 5_000
            ? store.activeRouteDirection.thenHint
            : undefined
        }
        banner={store.activeRouteDirection.banner}
      />
    ) : (
      <></>
    ),
  );
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
    () => ({
      minutes: store.activeRouteToFirstWayPointSummary?.minutes ?? 0,
      distance: toLengthAndUnit(
        store.activeRouteToFirstWayPointSummary?.distanceMeters ?? 0,
      ),
    }),
    { equals: comparer.structural },
  );

  const _RouteControls = observer(
    (props: { onExpandedToggle: (expanded: boolean) => void }) => (
      <RouteControls
        summary={routeSummary.get()}
        onExpandedToggle={props.onExpandedToggle}
        onManageStopsClick={
          store.activeRoute != null && store.activeRoute.segments.length > 1
            ? action(() => {
                navSheetController.startManageStopsFlow(navSheetStore);
                store.showNavSheet = true;
              })
            : undefined
        }
        onSearchAlongRouteClick={action(() => {
          navSheetController.startSearchAlongFlow(navSheetStore);
          store.showNavSheet = true;
        })}
        onRoutePreviewClick={action(() => {
          if (!store.activeRoute) {
            console.warn('no active route to preview');
            return;
          }
          const [minX, minY, maxX, maxY] = bbox(
            toFeatureCollection(store.activeRoute),
          );
          store.cameraMode = CameraMode.FREE;
          controller.fitPoints(store, [
            [minX, minY],
            [maxX, maxY],
          ]);
        })}
        onRouteDirectionsClick={action(() => {
          navSheetController.startShowActiveRouteDirectionsFlow(navSheetStore);
          store.showNavSheet = true;
        })}
        onRouteEndClick={action(() =>
          controller.setActiveRoute(store, undefined, appClient),
        )}
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
    return !store.isReceivingTelemetry ? <WaitingForTelemetry /> : <></>;
  });

  return {
    App: () => (
      <App
        store={store}
        transitionDurationMs={transitionDurationMs}
        SlippyMap={_SlippyMap}
        NavSheet={_NavSheet}
        RouteStack={_RouteStack}
        Controls={_Controls}
        WaitingForTelemetry={_WaitingForTelemetry}
      />
    ),
  };
}

const App = (props: {
  store: AppStore;
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
  const theme = useTheme();
  const isLargePortrait = useMediaQuery(
    theme.breakpoints.up('sm') + ' and (orientation: portrait)',
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
        height={'100vh'}
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
        height={'100vh'}
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
          top: 0,
          left: 0,
          right: 0,
          pointerEvents: 'none',
        }}
        padding={2}
        paddingBlockEnd={3}
        height={'100vh'}
      >
        <Grid
          size={{ xs: 12, sm: isLargePortrait ? 12 : 5 }}
          maxWidth={isLargePortrait ? undefined : 600}
          sx={{
            maxHeight: '100%',
          }}
        >
          <NavSheetContainer store={props.store}>
            <NavSheet />
          </NavSheetContainer>
        </Grid>
      </Grid>
      <WaitingForTelemetry />
    </SpriteProvider>
  );
};

const HudStackGridItem = observer(
  (props: {
    store: AppStore;
    transitionDurationMs: number;
    isLargePortrait: boolean;
    children: ReactElement;
  }) => {
    const showRouteStack =
      !props.store.showNavSheet && props.store.activeRoute != null;
    return (
      <Grid
        container
        alignItems={'stretch'}
        sx={{
          // apply top/bottom padding for portrait orientations, so that hud
          // controls don't overlap route controls.
          pt: {
            xs: showRouteStack ? 14 : 0,
            sm: props.isLargePortrait && showRouteStack ? 14 : 0,
          },
          pb: {
            xs: showRouteStack ? 13 : 0,
            sm: props.isLargePortrait && showRouteStack ? 13 : 0,
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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function bearingAfterStepManeuver(step: RouteStep): number {
  if (!step.arrowPoints || step.arrowPoints < 2) {
    return 0;
  }

  const arrowPoints = polyline.decode(step.geometry).slice(0, step.arrowPoints);
  return bearing(arrowPoints[0], arrowPoints[1]);
}

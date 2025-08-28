import { Box } from '@mui/joy';
import { Grid, Slide, useMediaQuery, useTheme } from '@mui/material';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { action, reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { DestinationMarkers } from './components/DestinationMarkers';
import { Directions } from './components/Directions';
import { PlayerMarker } from './components/PlayerMarker';
import { RouteStack } from './components/RouteStack';
import { SlippyMap } from './components/SlippyMap';
import { TrailerOrWaypointMarkers } from './components/TrailerOrWaypointMarkers';
import { AppControllerImpl, AppStoreImpl } from './controllers/app';
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

  const {
    NavSheet,
    controller: navSheetController,
    store: navSheetStore,
  } = createNavSheet({ appClient });
  const hideNavSheet = action(() => {
    controller.hideNavSheet(store);
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
    />
  );

  // TODO remove these reactions.
  // they're hacks while i figure out a better way to structure stores and controllers.
  reaction(
    () => navSheetStore.destinations.length > 0,
    hasDestinations =>
      // camera mode should probably be a computed. the only thing writeable
      // should be a "force Free" flag that gets set upon user gesture, and
      // cleared upon re-center click.
      (store.cameraMode = hasDestinations
        ? CameraMode.FREE
        : CameraMode.FOLLOW),
  );
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
    maybeLonLats => maybeLonLats && controller.fitPoints(maybeLonLats),
  );
  // render calls can be made directly by nav sheet controller.
  reaction(
    () => ({
      routes: navSheetStore.routes,
      selected: navSheetStore.selectedRoute,
    }),
    ({ routes, selected }) => {
      // HACK to make sure existing previews are cleared after navsheet reset
      [0, 1].forEach(index =>
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
      onRouteFabClick={action(() => controller.startRouteFlow(store))}
      // TODO make a first class search-along-route flow?
      onSearchFabClick={action(() => controller.startRouteFlow(store))}
    />
  );

  const onMapLoad = action((map: MapRef, marker: MapLibreGLMarker) => {
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
  const _TrailerOrWaypointMarkers = observer(() => (
    <TrailerOrWaypointMarkers
      trailerPoint={store.trailerPoint}
      activeRoute={store.activeRoute}
    />
  ));
  const _SlippyMap = observer(() => (
    <SlippyMap
      mode={store.themeMode}
      onLoad={onMapLoad}
      onDragStart={action(() => controller.onMapDragStart(store))}
      Destinations={_Destinations}
      TrailerOrWaypointMarkers={_TrailerOrWaypointMarkers}
      PlayerMarker={PlayerMarker}
    />
  ));

  const _Directions = observer(() =>
    store.activeRouteDirection ? (
      <Directions
        direction={store.activeRouteDirection.direction}
        distanceMeters={store.activeRouteDirection.distanceMeters}
        laneHint={store.activeRouteDirection.laneHint}
        thenHint={store.activeRouteDirection.thenHint}
        name={store.activeRouteDirection.name}
      />
    ) : (
      <></>
    ),
  );

  const _RouteStack = () => (
    <RouteStack
      Guidance={_Directions}
      onRouteEndClick={action(() =>
        controller.setActiveRoute(store, undefined, appClient),
      )}
    />
  );

  return {
    App: () => (
      <App
        store={store}
        transitionDurationMs={transitionDurationMs}
        SlippyMap={_SlippyMap}
        NavSheet={_NavSheet}
        RouteStack={_RouteStack}
        Controls={_Controls}
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
}) => {
  console.log('render app');
  const { SlippyMap, NavSheet, RouteStack, Controls } = props;
  const theme = useTheme();
  const isLargePortrait = useMediaQuery(
    theme.breakpoints.up('sm') + ' and (orientation: portrait)',
  );

  return (
    <>
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
    </>
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

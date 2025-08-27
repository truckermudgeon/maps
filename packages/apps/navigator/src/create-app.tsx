import { Box, Stack } from '@mui/joy';
import { Grid, Slide } from '@mui/material';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { action, reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement, ReactNode } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { DestinationMarkers } from './components/DestinationMarkers';
import { Directions } from './components/Directions';
import { PlayerMarker } from './components/PlayerMarker';
import { RouteControls } from './components/RouteControls';
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

  return {
    App: () => (
      <App
        store={store}
        SlippyMap={_SlippyMap}
        NavSheet={_NavSheet}
        Directions={_Directions}
        Controls={_Controls}
      />
    ),
  };
}

const App = (props: {
  store: AppStore;
  SlippyMap: () => ReactElement;
  NavSheet: () => ReactElement;
  Directions: () => ReactElement;
  Controls: () => ReactElement;
}) => {
  console.log('render app');
  const { SlippyMap, NavSheet, Directions, Controls } = props;

  /*

   * @default {
   *    // extra-small
   *    xs: 0,
   *    // small
   *    sm: 600,
   *    // medium
   *    md: 900,
   *    // large
   *    lg: 1200,
   *    // extra-large
   *    xl: 1536,
   */

  return (
    <>
      {Math.random() > 1 && <SlippyMap />}
      <Grid
        container={true}
        sx={{ flexGrow: 1, border: '4px solid green' }}
        padding={2}
        paddingBlockEnd={3}
        height={'100vh'}
        justifyContent={'space-between'}
      >
        {Math.random() > 5 && (
          <Grid>
            <NavSheetContainer store={props.store}>
              <NavSheet />
            </NavSheetContainer>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 9 }} maxWidth={600}>
          <RouteGuidanceContainer store={props.store}>
            <Directions />
            <RouteControls
              summary={{ minutes: 95, distanceMeters: 1234 }}
              expanded={false}
            />
          </RouteGuidanceContainer>
        </Grid>
      </Grid>
      <Grid
        columns={3}
        container={true}
        sx={{
          flexGrow: 1,
          border: '4px solid blue',
          position: 'absolute',
          top: 0,
          right: 0,
        }}
        padding={2}
        paddingBlockEnd={3}
        height={'100vh'}
      >
        <Grid container alignItems={'stretch'} sx={{ pt: { xs: 16, sm: 0 } }}>
          <Controls />
        </Grid>
      </Grid>
    </>
  );
};

const NavSheetContainer = observer(
  (props: { store: AppStore; children: ReactElement }) => (
    <Slide in={props.store.showNavSheet} direction={'right'}>
      <Box
        height={'100vh'}
        width={'42vw'}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 999, // needed so it's drawn over any highlighted destination map markers.
        }}
      >
        {props.children}
      </Box>
    </Slide>
  ),
);

const RouteGuidanceContainer = observer(
  (props: { store: AppStore; children: ReactNode }) => (
    <Slide
      in={Math.random() < 10 || props.store.activeRoute != null}
      direction={'right'}
    >
      <Stack
        height={'100%'}
        justifyContent={'space-between'}
        position={'relative'} // why is this needed for Directions to show?
        sx={{ border: '1px solid red' }}
      >
        {props.children}
      </Stack>
    </Slide>
  ),
);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

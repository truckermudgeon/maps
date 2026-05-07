import { Box } from '@mui/joy';
import { Grid, Slide, useMediaQuery, useTheme } from '@mui/material';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { SpriteProvider } from '../components/SpriteProvider';
import {
  maxPortraitSheetCssHeight,
  navSheetPagesRequiringMapVisibility,
} from '../controllers/constants';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { useRouteStore } from '../stores/hooks/use-route';
import { Controls } from './Controls';
import { NavSheet } from './NavSheet';
import { RouteStack } from './RouteStack';
import { SlippyMap } from './SlippyMap';
import { WaitingForTelemetry } from './WaitingForTelemetry';

export const AppLayout = observer(
  (props: {
    initialMap: 'usa' | 'europe';
    onMapLoad: (map: MapRef, marker: MapLibreGLMarker) => void;
    transitionDurationMs: number;
  }) => {
    console.log('render app');
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
        <SlippyMap initialMap={props.initialMap} onMapLoad={props.onMapLoad} />
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

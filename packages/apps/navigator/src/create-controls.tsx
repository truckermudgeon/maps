import { Directions, NavigationOutlined, Search } from '@mui/icons-material';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { Compass } from './components/Compass';
import { Fab } from './components/Fab';
import { HudStack } from './components/HudStack';
import { SpeedLimit } from './components/SpeedLimit';
import { BearingMode } from './controllers/constants';
import { ControlsStoreImpl } from './stores/controls';
import type {
  CameraStore,
  ControlsStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from './stores/types';
import { requestWakeLock } from './util/browser';

export function createControls(opts: {
  session: SessionStore;
  camera: CameraStore;
  route: RouteStore;
  navSheet: NavSheetStore;
}): {
  Controls: () => ReactElement;
  store: ControlsStore;
  bindMap: (map: MapRef) => void;
} {
  const { session, camera, navSheet } = opts;
  const store = new ControlsStoreImpl(session, camera, opts.route, navSheet);
  const bindMap = (map: MapRef) => {
    map.on(
      'move',
      action(() => (store.bearing = map.getBearing())),
    );
  };

  const _Compass = observer(() => (
    <Compass
      mode={session.themeMode}
      bearing={store.bearing}
      onClick={action(() => {
        requestWakeLock();
        switch (camera.bearingMode) {
          case BearingMode.MATCH_MAP:
            camera.setNorthLock();
            break;
          case BearingMode.NORTH_LOCK:
            camera.setNorthUnlock();
            break;
          default:
            throw new UnreachableError(camera.bearingMode);
        }
      })}
    />
  ));
  const _SpeedLimit = observer(() => (
    <SpeedLimit units={store.units} limit={store.limit} speed={store.speed} />
  ));
  const RecenterFab = observer(() => (
    <Fab
      show={store.showRecenterFab}
      variant={'plain'}
      backgroundColor={'background.body'}
      Icon={() => (
        <NavigationOutlined sx={{ transform: 'scale(1.25) rotate(30deg)' }} />
      )}
      onClick={action(() => {
        requestWakeLock();
        camera.setFollow();
      })}
    />
  ));
  const RouteFab = observer(() => (
    <Fab
      show={store.showRouteFab}
      Icon={() => <Directions sx={{ transform: 'scale(1.25)' }} />}
      onClick={action(() => {
        requestWakeLock();
        navSheet.startChooseDestinationFlow();
      })}
    />
  ));
  const SearchFab = observer(() => (
    <Fab
      show={store.showSearchFab}
      Icon={() => <Search sx={{ transform: 'scale(1.25)' }} />}
      onClick={action(() => {
        requestWakeLock();
        navSheet.startSearchAlongFlow();
      })}
    />
  ));

  return {
    Controls: () => (
      <HudStack
        Direction={_Compass}
        SpeedLimit={_SpeedLimit}
        RecenterFab={RecenterFab}
        RouteFab={RouteFab}
        SearchFab={SearchFab}
      />
    ),
    store,
    bindMap,
  };
}

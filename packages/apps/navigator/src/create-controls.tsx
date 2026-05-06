import { Directions, NavigationOutlined, Search } from '@mui/icons-material';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { Compass } from './components/Compass';
import { Fab } from './components/Fab';
import { HudStack } from './components/HudStack';
import { SpeedLimit } from './components/SpeedLimit';
import { ControlsStoreImpl } from './controllers/controls';
import type { ControlsStore } from './controllers/types';
import type {
  CameraStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from './stores/types';

interface ControlsProps {
  onCompassClick: () => void;
  onRecenterFabClick: () => void;
  onRouteFabClick: () => void;
  onSearchFabClick: () => void;
}

export function createControls(opts: {
  session: SessionStore;
  camera: CameraStore;
  route: RouteStore;
  navSheet: NavSheetStore;
}): {
  Controls: (props: ControlsProps) => ReactElement;
  store: ControlsStore;
  bindMap: (map: MapRef) => void;
} {
  const { session, camera, route, navSheet } = opts;
  const store = new ControlsStoreImpl(session, camera, route, navSheet);
  const bindMap = (map: MapRef) => {
    map.on(
      'move',
      action(() => (store.bearing = map.getBearing())),
    );
  };

  const _Compass = observer((props: { onClick: () => void }) => (
    <Compass
      mode={session.themeMode}
      bearing={store.bearing}
      onClick={props.onClick}
    />
  ));
  const _SpeedLimit = observer(() => (
    <SpeedLimit units={store.units} limit={store.limit} speed={store.speed} />
  ));
  const RecenterFab = observer((props: { onClick: () => void }) => (
    <Fab
      show={store.showRecenterFab}
      variant={'plain'}
      backgroundColor={'background.body'}
      Icon={() => (
        <NavigationOutlined sx={{ transform: 'scale(1.25) rotate(30deg)' }} />
      )}
      onClick={props.onClick}
    />
  ));
  const RouteFab = observer((props: { onClick: () => void }) => (
    <Fab
      show={store.showRouteFab}
      Icon={() => <Directions sx={{ transform: 'scale(1.25)' }} />}
      onClick={props.onClick}
    />
  ));
  const SearchFab = observer((props: { onClick: () => void }) => (
    <Fab
      show={store.showSearchFab}
      Icon={() => <Search sx={{ transform: 'scale(1.25)' }} />}
      onClick={props.onClick}
    />
  ));

  return {
    Controls: (props: ControlsProps) => {
      return (
        <HudStack
          Direction={() => <_Compass onClick={props.onCompassClick} />}
          SpeedLimit={_SpeedLimit}
          RecenterFab={() => <RecenterFab onClick={props.onRecenterFabClick} />}
          RouteFab={() => <RouteFab onClick={props.onRouteFabClick} />}
          SearchFab={() => <SearchFab onClick={props.onSearchFabClick} />}
        />
      );
    },
    store,
    bindMap,
  };
}

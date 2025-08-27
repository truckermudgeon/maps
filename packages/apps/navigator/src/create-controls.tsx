import { Directions, NavigationOutlined, Search } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import { Fab } from './components/Fab';
import { HudStack } from './components/HudStack';
import { SpeedLimit } from './components/SpeedLimit';
import { TextCompass } from './components/TextCompass';
import {
  ControlsControllerImpl,
  ControlsStoreImpl,
} from './controllers/controls';
import type {
  AppStore,
  ControlsController,
  ControlsStore,
} from './controllers/types';

interface ControlsProps {
  onRecenterFabClick: () => void;
  onRouteFabClick: () => void;
  onSearchFabClick: () => void;
}

export function createControls(opts: { appStore: AppStore }): {
  Controls: (props: ControlsProps) => ReactElement;
  store: ControlsStore;
  controller: ControlsController;
} {
  const { appStore } = opts;
  const store = new ControlsStoreImpl(appStore);
  const controller = new ControlsControllerImpl();

  const _TextCompass = observer(() => (
    <TextCompass direction={store.direction} />
  ));
  const _SpeedLimit = observer(() => (
    <SpeedLimit limitMph={store.limitMph} speedMph={store.speedMph} />
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
          Direction={_TextCompass}
          SpeedLimit={_SpeedLimit}
          RecenterFab={() => <RecenterFab onClick={props.onRecenterFabClick} />}
          RouteFab={() => <RouteFab onClick={props.onRouteFabClick} />}
          SearchFab={() => <SearchFab onClick={props.onSearchFabClick} />}
        />
      );
    },
    store,
    controller,
  };
}

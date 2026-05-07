import { Directions, NavigationOutlined, Search } from '@mui/icons-material';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Compass } from '../components/Compass';
import { Fab } from '../components/Fab';
import { HudStack } from '../components/HudStack';
import { SpeedLimit } from '../components/SpeedLimit';
import { BearingMode } from '../stores/camera';
import { useCameraStore } from '../stores/hooks/use-camera';
import { useControlsStore } from '../stores/hooks/use-controls';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { useSessionStore } from '../stores/hooks/use-session';
import { requestWakeLock } from '../util/browser';

export const Controls = () => (
  <HudStack
    Direction={CompassControl}
    SpeedLimit={SpeedLimitControl}
    RecenterFab={RecenterFab}
    RouteFab={RouteFab}
    SearchFab={SearchFab}
  />
);

const CompassControl = observer(() => {
  const session = useSessionStore();
  const camera = useCameraStore();
  const controls = useControlsStore();
  return (
    <Compass
      mode={session.themeMode}
      bearing={controls.bearing}
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
  );
});

const SpeedLimitControl = observer(() => {
  const controls = useControlsStore();
  return (
    <SpeedLimit
      units={controls.units}
      limit={controls.limit}
      speed={controls.speed}
    />
  );
});

const RecenterFab = observer(() => {
  const camera = useCameraStore();
  const controls = useControlsStore();
  return (
    <Fab
      show={controls.showRecenterFab}
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
  );
});

const RouteFab = observer(() => {
  const controls = useControlsStore();
  const navSheet = useNavSheetStore();
  return (
    <Fab
      show={controls.showRouteFab}
      Icon={() => <Directions sx={{ transform: 'scale(1.25)' }} />}
      onClick={action(() => {
        requestWakeLock();
        navSheet.startChooseDestinationFlow();
      })}
    />
  );
});

const SearchFab = observer(() => {
  const controls = useControlsStore();
  const navSheet = useNavSheetStore();
  return (
    <Fab
      show={controls.showSearchFab}
      Icon={() => <Search sx={{ transform: 'scale(1.25)' }} />}
      onClick={action(() => {
        requestWakeLock();
        navSheet.startSearchAlongFlow();
      })}
    />
  );
});

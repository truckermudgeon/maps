import { assertExists } from '@truckermudgeon/base/assert';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { RouteStepsList } from '../../components/RouteStepsList';
import { useMapCamera, useRouteRenderer } from '../../services/context';
import { useNavSheetStore } from '../../stores/hooks/use-nav-sheet';
import { useSessionStore } from '../../stores/hooks/use-session';
import { bearingAfterStepManeuver } from '../../util/route-features';

export const DirectionsFromRoutesListPage = observer(() => {
  const session = useSessionStore();
  const navSheetStore = useNavSheetStore();
  const mapCamera = useMapCamera();
  const routeRenderer = useRouteRenderer();
  return (
    <RouteStepsList
      units={session.map === 'usa' ? 'imperial' : 'metric'}
      route={assertExists(navSheetStore.selectedRoute)}
      onStepClick={action(step => {
        mapCamera.flyTo(step.maneuver.lonLat, bearingAfterStepManeuver(step));
        routeRenderer.drawStepArrow(step);
      })}
    />
  );
});

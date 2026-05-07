import { assertExists } from '@truckermudgeon/base/assert';
import { observer } from 'mobx-react-lite';
import { RouteStepsList } from '../../components/RouteStepsList';
import { useRouteStore } from '../../stores/hooks/use-route';
import { useSessionStore } from '../../stores/hooks/use-session';

export const DirectionsFromRouteControlsPage = observer(() => {
  const session = useSessionStore();
  const routeStore = useRouteStore();
  return (
    <RouteStepsList
      units={session.map === 'usa' ? 'imperial' : 'metric'}
      route={assertExists(routeStore.activeRoute)}
    />
  );
});

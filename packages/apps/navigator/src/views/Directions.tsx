import { observer } from 'mobx-react-lite';
import { AnimatedDirections } from '../components/AnimatedDirections';
import { useRouteStore } from '../stores/hooks/use-route';
import { useSessionStore } from '../stores/hooks/use-session';

export const Directions = observer(() => {
  const route = useRouteStore();
  const session = useSessionStore();
  return (
    <AnimatedDirections
      direction={route.activeRouteDirection}
      distanceToNextManeuver={route.distanceToNextManeuver}
      units={session.map === 'usa' ? 'imperial' : 'metric'}
    />
  );
});

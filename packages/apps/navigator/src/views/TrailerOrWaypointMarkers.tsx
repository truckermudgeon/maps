import { observer } from 'mobx-react-lite';
import { TrailerOrWaypointMarkers as TrailerOrWaypointMarkersComponent } from '../components/TrailerOrWaypointMarkers';
import { useRouteStore } from '../stores/hooks/use-route';

export const TrailerOrWaypointMarkers = observer(() => {
  const route = useRouteStore();
  const trailerPoint = route.trailerPoint?.map(n => Number(n.toFixed(6))) as
    | [number, number]
    | undefined;
  return (
    <TrailerOrWaypointMarkersComponent
      trailerPoint={trailerPoint}
      activeRoute={route.activeRoute}
    />
  );
});

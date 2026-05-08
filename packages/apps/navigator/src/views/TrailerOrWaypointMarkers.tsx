import { comparer, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { TrailerOrWaypointMarkers as TrailerOrWaypointMarkersComponent } from '../components/TrailerOrWaypointMarkers';
import { useRouteStore } from '../stores/hooks/use-route';

export const TrailerOrWaypointMarkers = observer(() => {
  const route = useRouteStore();
  const trailerPoint = computed(
    () =>
      route.trailerPoint?.map(n => Number(n.toFixed(6))) as
        | [number, number]
        | undefined,
    {
      equals: comparer.structural,
    },
  );
  return (
    <TrailerOrWaypointMarkersComponent
      trailerPoint={trailerPoint.get()}
      activeRoute={route.activeRoute}
    />
  );
});

import { arrayMove } from '@dnd-kit/sortable';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { ManageStopsPage as ManageStopsPageComponent } from '../../components/ManageStopsPage';
import { useAppController, useHideNavSheet } from '../../services/context';
import { useRouteStore } from '../../stores/hooks/use-route';

export const ManageStopsPage = observer(() => {
  const routeStore = useRouteStore();
  const appController = useAppController();
  const hideNavSheet = useHideNavSheet();
  const { activeRoute, activeRouteIndex, activeRouteSummary } = routeStore;
  const [waypoints, setWaypoints] = useState<
    { id: string; description: string; nodeUid: bigint }[]
  >(
    activeRoute != null
      ? activeRoute.segments
          .slice(activeRouteIndex?.segmentIndex)
          .map((segment, index) => {
            const lastNodeUid = BigInt('0x' + segment.key.split('-')[1]);
            return {
              id: lastNodeUid.toString(16) + '-' + index,
              description:
                segment.steps.at(-1)!.maneuver.banner?.text ?? 'Waypoint',
              nodeUid: lastNodeUid,
            };
          })
      : [],
  );

  if (!activeRoute) {
    return null;
  }

  const handleReorder = (op: { oldIndex: number; newIndex: number }) => {
    const newWaypoints = arrayMove(waypoints, op.oldIndex, op.newIndex);
    setWaypoints(newWaypoints);
    appController.setActiveRouteFromNodeUids(
      newWaypoints.map(wp => wp.nodeUid),
    );
  };

  const handleDelete = (index: number) => {
    waypoints.splice(index, 1);
    const newWaypoints = waypoints.slice(0);
    setWaypoints(newWaypoints);
    appController.setActiveRouteFromNodeUids(
      newWaypoints.map(wp => wp.nodeUid),
    );
  };

  return (
    <ManageStopsPageComponent
      summary={activeRouteSummary ?? { distanceMeters: 0, minutes: 0 }}
      waypoints={waypoints}
      onDoneClick={action(hideNavSheet)}
      onWaypointReorder={action(handleReorder)}
      onWaypointDelete={action(handleDelete)}
    />
  );
});

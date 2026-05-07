import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { RouteControls as RouteControlsComponent } from '../components/RouteControls';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from '../components/text';
import { CameraMode } from '../controllers/constants';
import { useAppController, useMapAdapter } from '../services/context';
import { useCameraStore } from '../stores/hooks/use-camera';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { useRouteStore } from '../stores/hooks/use-route';
import { useSessionStore } from '../stores/hooks/use-session';
import { routeCornerPair } from '../util/route-bounds';
import { toRouteSummary } from '../util/route-display';

export const RouteControls = observer(
  (props: { onExpandedToggle: (expanded: boolean) => void }) => {
    const route = useRouteStore();
    const session = useSessionStore();
    const camera = useCameraStore();
    const navSheetStore = useNavSheetStore();
    const controller = useAppController();
    const mapAdapter = useMapAdapter();

    const summary = toRouteSummary(
      route.activeRouteToFirstWayPointSummary,
      session.map === 'usa' ? defaultImperialOptions : defaultMetricOptions,
    );
    const showManageStops =
      route.activeRoute != null && route.activeRoute.segments.length > 1;
    return (
      <RouteControlsComponent
        summary={summary}
        onExpandedToggle={props.onExpandedToggle}
        onManageStopsClick={
          showManageStops
            ? action(() => navSheetStore.startManageStopsFlow())
            : undefined
        }
        onSearchAlongRouteClick={action(() =>
          navSheetStore.startSearchAlongFlow(),
        )}
        onRoutePreviewClick={action(() => {
          if (!route.activeRoute) {
            console.warn('no active route to preview');
            return;
          }
          camera.cameraMode = CameraMode.FREE;
          mapAdapter.fitPoints(routeCornerPair(route.activeRoute));
        })}
        onRouteDirectionsClick={action(() =>
          navSheetStore.startShowActiveRouteDirectionsFlow(),
        )}
        onRouteEndClick={action(() => controller.setActiveRoute(undefined))}
      />
    );
  },
);

import { observer } from 'mobx-react-lite';
import { RouteControls as RouteControlsComponent } from '../components/RouteControls';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from '../components/text';
import type { RouteControlsCallbacks } from '../create-app-handlers';
import { useRouteStore } from '../stores/hooks/use-route';
import { useSessionStore } from '../stores/hooks/use-session';
import { toRouteSummary } from '../util/route-display';

export const RouteControls = observer(
  (props: {
    callbacks: RouteControlsCallbacks;
    onExpandedToggle: (expanded: boolean) => void;
  }) => {
    const route = useRouteStore();
    const session = useSessionStore();
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
          showManageStops ? props.callbacks.onManageStops : undefined
        }
        onSearchAlongRouteClick={props.callbacks.onSearchAlongRoute}
        onRoutePreviewClick={props.callbacks.onRoutePreview}
        onRouteDirectionsClick={props.callbacks.onRouteDirections}
        onRouteEndClick={props.callbacks.onRouteEnd}
      />
    );
  },
);

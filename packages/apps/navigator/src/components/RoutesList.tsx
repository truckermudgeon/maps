import { List } from '@mui/joy';
import type { Route, RouteWithSummary } from '@truckermudgeon/navigation/types';
import { RouteItem } from './RouteItem';

export const RoutesList = (props: {
  routes: RouteWithSummary[];
  onRouteHighlight: (route: Route) => void;
  onRouteDetailsClick: (route: Route) => void;
  onRouteGoClick: (route: Route) => void;
}) => {
  console.log('render route list');
  const { onRouteHighlight, onRouteDetailsClick, onRouteGoClick } = props;
  const _RouteItem = (props: { route: RouteWithSummary }) => (
    <RouteItem
      route={props.route}
      onRouteHighlight={() => onRouteHighlight(props.route)}
      onRouteDetailsClick={() => onRouteDetailsClick(props.route)}
      onRouteGoClick={() => onRouteGoClick(props.route)}
    />
  );

  return (
    <List size={'lg'}>
      {props.routes.map(route => (
        <_RouteItem key={route.id} route={route} />
      ))}
    </List>
  );
};

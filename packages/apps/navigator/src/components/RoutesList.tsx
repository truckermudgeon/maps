import { List } from '@mui/joy';
import type { Route } from '@truckermudgeon/navigation/types';
import { RouteItem } from './RouteItem';

export const RoutesList = (props: {
  routes: Route[];
  onRouteHighlight: (route: Route) => void;
  onRouteGoClick: (route: Route) => void;
}) => {
  console.log('render route list');
  const { onRouteHighlight, onRouteGoClick } = props;
  const _RouteItem = (props: { route: Route }) => (
    <RouteItem
      route={props.route}
      onRouteHighlight={() => onRouteHighlight(props.route)}
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

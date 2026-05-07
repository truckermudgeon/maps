import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { RoutesList } from '../../components/RoutesList';
import { withLoading } from '../../components/WithLoading';
import { useAppController, useHideNavSheet } from '../../services/context';
import { useNavSheetStore } from '../../stores/hooks/use-nav-sheet';
import { useSessionStore } from '../../stores/hooks/use-session';

const RoutesListWithLoading = withLoading(RoutesList);

export const RoutesPage = observer(() => {
  const session = useSessionStore();
  const navSheetStore = useNavSheetStore();
  const appController = useAppController();
  const hideNavSheet = useHideNavSheet();
  return (
    <RoutesListWithLoading
      units={session.map === 'usa' ? 'imperial' : 'metric'}
      isLoading={navSheetStore.isLoading}
      routes={navSheetStore.routes}
      onRouteHighlight={action(route => navSheetStore.highlightRoute(route))}
      onRouteDetailsClick={action(route =>
        navSheetStore.showRouteDetails(route),
      )}
      onRouteGoClick={action(route => {
        navSheetStore.selectRoute(route);
        appController.setActiveRoute(route);
        hideNavSheet();
      })}
    />
  );
});

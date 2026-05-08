import { UnreachableError } from '@truckermudgeon/base/precon';
import { observer } from 'mobx-react-lite';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { NavPageKey } from '../stores/nav-sheet';
import { ChooseDestinationPage } from './nav-sheet/ChooseDestinationPage';
import { ChooseOnMapPage } from './nav-sheet/ChooseOnMapPage';
import { DestinationsListPage } from './nav-sheet/DestinationsListPage';
import { DirectionsFromRouteControlsPage } from './nav-sheet/DirectionsFromRouteControlsPage';
import { DirectionsFromRoutesListPage } from './nav-sheet/DirectionsFromRoutesListPage';
import { ManageStopsPage } from './nav-sheet/ManageStopsPage';
import { RoutesPage } from './nav-sheet/RoutesPage';

export const CurrentNavPage = observer(() => {
  const navSheetStore = useNavSheetStore();
  switch (navSheetStore.currentPageKey) {
    case NavPageKey.CHOOSE_DESTINATION:
      return <ChooseDestinationPage mode={'chooseDestination'} />;
    case NavPageKey.SEARCH_ALONG:
      return <ChooseDestinationPage mode={'searchAlong'} />;
    case NavPageKey.CHOOSE_ON_MAP:
      return <ChooseOnMapPage />;
    case NavPageKey.DESTINATIONS:
      return <DestinationsListPage />;
    case NavPageKey.ROUTES:
      return <RoutesPage />;
    case NavPageKey.DIRECTIONS_FROM_ROUTES_LIST:
      return <DirectionsFromRoutesListPage />;
    case NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS:
      return <DirectionsFromRouteControlsPage />;
    case NavPageKey.MANAGE_STOPS:
      return <ManageStopsPage />;
    default:
      throw new UnreachableError(navSheetStore.currentPageKey);
  }
});

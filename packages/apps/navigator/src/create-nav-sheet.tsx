import { UnreachableError } from '@truckermudgeon/base/precon';
import type { SearchResult } from '@truckermudgeon/navigation/types';
import { action, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { CollapsibleButtonBar } from './components/CollapsibleButtonBar';
import { DestinationList } from './components/DestinationList';
import { DestinationTypes } from './components/DestinationTypes';
import { NavSheet } from './components/NavSheet';
import { RoutesList } from './components/RoutesList';
import { TitleControls } from './components/TitleControls';
import { withLoading } from './components/WithLoading';
import { NavPageKey } from './controllers/constants';
import {
  NavSheetControllerImpl,
  NavSheetStoreImpl,
} from './controllers/nav-sheet';
import type {
  AppClient,
  NavSheetController,
  NavSheetStore,
} from './controllers/types';

interface NavSheetProps {
  onCloseClick: () => void;
  onDestinationGoClick: () => void;
  onRouteGoClick: () => void;
}

export function createNavSheet({ appClient }: { appClient: AppClient }): {
  NavSheet: (props: NavSheetProps) => React.ReactElement;
  store: NavSheetStore;
  controller: NavSheetController;
} {
  const store = new NavSheetStoreImpl();
  const controller = new NavSheetControllerImpl(appClient);
  const { CurrentNavPage } = createCurrentNavPage({ store, controller });

  const _TitleControls = observer((props: { onCloseClick: () => void }) => (
    <TitleControls
      showBackButton={store.showBackButton}
      title={store.title}
      onBackClick={action(() => controller.onBackClick(store))}
      onCloseClick={props.onCloseClick}
    />
  ));
  const _NavSheet = (props: NavSheetProps) => (
    <NavSheet
      TitleControls={() => <_TitleControls onCloseClick={props.onCloseClick} />}
      CurrentPage={() => (
        <CurrentNavPage
          onDestinationGoClick={props.onDestinationGoClick}
          onRouteGoClick={props.onRouteGoClick}
        />
      )}
    />
  );

  return {
    NavSheet: _NavSheet,
    store,
    controller,
  };
}

function createCurrentNavPage(opts: {
  store: NavSheetStore;
  controller: NavSheetController;
}) {
  const { store, controller } = opts;
  const TypesPage = () => (
    <DestinationTypes
      onClick={action(type => controller.onDestinationTypeClick(store, type))}
    />
  );
  const _DestinationList = withLoading(DestinationList);
  const ListPage = observer((props: { onDestinationGoClick: () => void }) => {
    const _CollapsibleButtonBar = observer(
      ({ destination }: { destination: SearchResult }) => {
        // use a computed to minimize re-renders (e.g., collapsed button bars
        // that stay collapsed don't need to re-render, even if
        // selectedDestination changes)
        const visible = computed(
          () => store.selectedDestination === destination,
        );
        return (
          <CollapsibleButtonBar
            visible={visible.get()}
            onDestinationRoutesClick={action(() =>
              controller.onDestinationRoutesClick(store, destination),
            )}
            onDestinationGoClick={action(() => {
              controller.onDestinationGoClick(store, destination);
              props.onDestinationGoClick();
            })}
          />
        );
      },
    );
    return (
      <_DestinationList
        isLoading={store.isLoading}
        destinations={store.destinations}
        CollapsibleButtonBar={_CollapsibleButtonBar}
        onDestinationHighlight={action(dest =>
          controller.onDestinationHighlight(store, dest),
        )}
      />
    );
  });
  const _RoutesList = withLoading(RoutesList);
  const RoutesPage = observer((props: { onRouteGoClick: () => void }) => (
    <_RoutesList
      isLoading={store.isLoading}
      routes={store.routes}
      onRouteHighlight={action(route =>
        controller.onRouteHighlight(store, route),
      )}
      onRouteGoClick={action(route => {
        controller.onRouteGoClick(store, route);
        props.onRouteGoClick();
      })}
    />
  ));

  return {
    CurrentNavPage: observer(
      (props: {
        onDestinationGoClick: () => void;
        onRouteGoClick: () => void;
      }) => {
        console.log('render current nav pag', store.currentPageKey);
        switch (store.currentPageKey) {
          case NavPageKey.CATEGORIES:
            return <TypesPage />;
          case NavPageKey.DESTINATIONS:
            return (
              <ListPage onDestinationGoClick={props.onDestinationGoClick} />
            );
          case NavPageKey.ROUTES:
            return <RoutesPage onRouteGoClick={props.onRouteGoClick} />;
          default:
            throw new UnreachableError(store.currentPageKey);
        }
      },
    ),
  };
}

import { arrayMove } from '@dnd-kit/sortable';
import { assertExists } from '@truckermudgeon/base/assert';
import { debounce } from '@truckermudgeon/base/debounce';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { RouteStep, SearchResult } from '@truckermudgeon/navigation/types';
import { action, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import { ChooseDestinationPage } from './components/ChooseDestinationPage';
import type { ChooseOnMapPageProps } from './components/ChooseOnMapPage';
import { ChooseOnMapPage } from './components/ChooseOnMapPage';
import { CollapsibleButtonBar } from './components/CollapsibleButtonBar';
import { DestinationList } from './components/DestinationList';
import { ManageStopsPage } from './components/ManageStopsPage';
import { NavSheet } from './components/NavSheet';
import { RoutesList } from './components/RoutesList';
import { RouteStepsList } from './components/RouteStepsList';
import { TitleControls } from './components/TitleControls';
import { withLoading } from './components/WithLoading';
import { NavPageKey } from './controllers/constants';
import { NavSheetControllerImpl } from './controllers/nav-sheet';
import type {
  AppClient,
  NavSheetController,
  NavSheetStore,
} from './controllers/types';
import type { MapAdapter } from './services/map-adapter';
import { NavSheetStoreImpl } from './stores/nav-sheet';
import type { RouteStore, SessionStore } from './stores/types';

interface NavSheetProps {
  onCloseClick: () => void;
  onDestinationGoClick: () => void;
  onRouteGoClick: () => void;
  onRouteStepClick: (step: RouteStep) => void;
  onRouteToPointClick: () => void;
  onWaypointsChange: (waypoints: bigint[]) => void;
}

export function createNavSheet({
  appClient,
  session,
  route,
  mapAdapter,
  store,
}: {
  appClient: AppClient;
  session: SessionStore;
  route: RouteStore;
  mapAdapter: MapAdapter;
  store: NavSheetStoreImpl;
}): {
  NavSheet: (props: NavSheetProps) => React.ReactElement;
  controller: NavSheetController;
} {
  const controller = new NavSheetControllerImpl(store, appClient, mapAdapter);
  const { CurrentNavPage } = createCurrentNavPage({
    store,
    controller,
    session,
    route,
  });

  const _TitleControls = observer((props: { onCloseClick: () => void }) => (
    <TitleControls
      showBackButton={store.showBackButton}
      title={store.title}
      onBackClick={action(() => controller.onBackClick())}
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
          onRouteStepClick={props.onRouteStepClick}
          onRouteToPointClick={props.onRouteToPointClick}
          onManageStopsDoneClick={props.onCloseClick}
          onWaypointsChange={props.onWaypointsChange}
        />
      )}
    />
  );

  return {
    NavSheet: _NavSheet,
    controller,
  };
}

function createCurrentNavPage(opts: {
  store: NavSheetStore;
  controller: NavSheetController;
  session: SessionStore;
  route: RouteStore;
}) {
  const { store, controller, session, route: routeStore } = opts;
  const _ChooseDestinationPage = () => {
    const [options, setOptions] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const onInput = useCallback(
      (value: string) => {
        if (value.trim().length === 0) {
          setOptions([]);
          return;
        }
        if (loading) {
          return;
        }

        setLoading(true);
        controller
          .search(value)
          .then(
            results => setOptions(results),
            error => console.log('search failed:', error),
          )
          .finally(() => setLoading(false));
      },
      [loading],
    );
    const debouncedOnInput = debounce(onInput, 250);
    return (
      <ChooseDestinationPage
        showSearchLoading={loading}
        mode={'chooseDestination'}
        onSelect={action(stringOrResult =>
          controller.onSearchSelect(stringOrResult),
        )}
        onInputChange={debouncedOnInput}
        onDestinationTypeClick={action((type, label) =>
          controller.onDestinationTypeClick(type, label),
        )}
        onChooseOnMapClick={action(() => store.openChooseOnMap())}
        options={options}
      />
    );
  };
  const _SearchAlongRoutePage = () => {
    const [options, setOptions] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const onInput = useCallback(
      (value: string) => {
        if (value.trim().length === 0) {
          setOptions([]);
          return;
        }
        if (loading) {
          return;
        }

        setLoading(true);
        controller
          .search(value)
          .then(
            results => setOptions(results),
            error => console.log('search failed:', error),
          )
          .finally(() => setLoading(false));
      },
      [loading],
    );
    const debouncedOnInput = debounce(onInput, 250);
    return (
      <ChooseDestinationPage
        mode={'searchAlong'}
        showSearchLoading={loading}
        onSelect={action(stringOrResult =>
          controller.onSearchSelect(stringOrResult),
        )}
        onInputChange={debouncedOnInput}
        onDestinationTypeClick={action((type, label) =>
          controller.onDestinationTypeClick(type, label),
        )}
        onChooseOnMapClick={action(() => store.openChooseOnMap())}
        options={options}
      />
    );
  };
  const _ChooseOnMapPageWithLoading = withLoading(ChooseOnMapPage);
  const _ChooseOnMapPage = observer((props: ChooseOnMapPageProps) => (
    <_ChooseOnMapPageWithLoading
      isLoading={store.isLoading}
      onUseThisPointClick={props.onUseThisPointClick}
    />
  ));
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
              controller.onDestinationRoutesClick(destination),
            )}
            onDestinationGoClick={action(() => {
              store.selectDestination(destination);
              props.onDestinationGoClick();
            })}
          />
        );
      },
    );
    return (
      <_DestinationList
        units={session.map === 'usa' ? 'imperial' : 'metric'}
        isLoading={store.isLoading}
        destinations={store.destinations}
        CollapsibleButtonBar={_CollapsibleButtonBar}
        onDestinationHighlight={action(dest =>
          store.highlightDestination(dest),
        )}
      />
    );
  });
  const _RoutesList = withLoading(RoutesList);
  const RoutesPage = observer((props: { onRouteGoClick: () => void }) => (
    <_RoutesList
      units={session.map === 'usa' ? 'imperial' : 'metric'}
      isLoading={store.isLoading}
      routes={store.routes}
      onRouteHighlight={action(route => store.highlightRoute(route))}
      onRouteDetailsClick={action(route => store.showRouteDetails(route))}
      onRouteGoClick={action(route => {
        store.selectRoute(route);
        props.onRouteGoClick();
      })}
    />
  ));
  const _ManageStopsPage = observer(
    (props: {
      onDoneClick: () => void;
      onWaypointsChange: (waypoints: bigint[]) => void;
    }) => {
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
        props.onWaypointsChange(newWaypoints.map(wp => wp.nodeUid));
      };

      const handleDelete = (index: number) => {
        waypoints.splice(index, 1);
        const newWaypoints = waypoints.slice(0);
        setWaypoints(newWaypoints);
        props.onWaypointsChange(newWaypoints.map(wp => wp.nodeUid));
      };

      return (
        <ManageStopsPage
          summary={activeRouteSummary ?? { distanceMeters: 0, minutes: 0 }}
          waypoints={waypoints}
          onDoneClick={action(props.onDoneClick)}
          onWaypointReorder={action(handleReorder)}
          onWaypointDelete={action(handleDelete)}
        />
      );
    },
  );

  return {
    CurrentNavPage: observer(
      (props: {
        onDestinationGoClick: () => void;
        onRouteGoClick: () => void;
        onRouteStepClick: (step: RouteStep) => void;
        onRouteToPointClick: () => void;
        onManageStopsDoneClick: () => void;
        onWaypointsChange: (nodeUids: bigint[]) => void;
      }) => {
        console.log('render current nav pag', store.currentPageKey);
        switch (store.currentPageKey) {
          case NavPageKey.CHOOSE_DESTINATION:
            return <_ChooseDestinationPage />;
          case NavPageKey.SEARCH_ALONG:
            return <_SearchAlongRoutePage />;
          case NavPageKey.CHOOSE_ON_MAP:
            return (
              <_ChooseOnMapPage
                onUseThisPointClick={props.onRouteToPointClick}
              />
            );
          case NavPageKey.DESTINATIONS:
            return (
              <ListPage onDestinationGoClick={props.onDestinationGoClick} />
            );
          case NavPageKey.ROUTES:
            return <RoutesPage onRouteGoClick={props.onRouteGoClick} />;
          case NavPageKey.DIRECTIONS_FROM_ROUTES_LIST:
            return (
              <RouteStepsList
                units={session.map === 'usa' ? 'imperial' : 'metric'}
                route={assertExists(store.selectedRoute)}
                onStepClick={props.onRouteStepClick}
              />
            );
          case NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS:
            return (
              <RouteStepsList
                units={session.map === 'usa' ? 'imperial' : 'metric'}
                route={assertExists(routeStore.activeRoute)}
              />
            );
          case NavPageKey.MANAGE_STOPS:
            return (
              <_ManageStopsPage
                onDoneClick={props.onManageStopsDoneClick}
                onWaypointsChange={props.onWaypointsChange}
              />
            );
          default:
            throw new UnreachableError(store.currentPageKey);
        }
      },
    ),
  };
}

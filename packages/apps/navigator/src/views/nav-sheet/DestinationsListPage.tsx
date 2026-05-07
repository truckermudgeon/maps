import type { SearchResult } from '@truckermudgeon/navigation/types';
import { action, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { CollapsibleButtonBar } from '../../components/CollapsibleButtonBar';
import { DestinationList } from '../../components/DestinationList';
import { withLoading } from '../../components/WithLoading';
import {
  useAppController,
  useHideNavSheet,
  useNavSheetController,
} from '../../services/context';
import { useNavSheetStore } from '../../stores/hooks/use-nav-sheet';
import { useSessionStore } from '../../stores/hooks/use-session';

const DestinationListWithLoading = withLoading(DestinationList);

export const DestinationsListPage = observer(() => {
  const session = useSessionStore();
  const navSheetStore = useNavSheetStore();
  const navSheetController = useNavSheetController();
  const appController = useAppController();
  const hideNavSheet = useHideNavSheet();

  const Bar = observer(({ destination }: { destination: SearchResult }) => {
    // use a computed to minimize re-renders (e.g., collapsed button bars
    // that stay collapsed don't need to re-render, even if
    // selectedDestination changes)
    const visible = computed(
      () => navSheetStore.selectedDestination === destination,
    );
    return (
      <CollapsibleButtonBar
        visible={visible.get()}
        onDestinationRoutesClick={action(() =>
          navSheetController.onDestinationRoutesClick(destination),
        )}
        onDestinationGoClick={action(() => {
          navSheetStore.selectDestination(destination);
          appController.setDestinationNodeUid(destination.nodeUid);
          hideNavSheet();
        })}
      />
    );
  });

  return (
    <DestinationListWithLoading
      units={session.map === 'usa' ? 'imperial' : 'metric'}
      isLoading={navSheetStore.isLoading}
      destinations={navSheetStore.destinations}
      CollapsibleButtonBar={Bar}
      onDestinationHighlight={action(dest =>
        navSheetStore.highlightDestination(dest),
      )}
    />
  );
});

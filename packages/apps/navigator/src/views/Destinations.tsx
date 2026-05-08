import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DestinationMarkers } from '../components/DestinationMarkers';
import { useNavSheetController } from '../services/context';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';
import { NavPageKey } from '../stores/nav-sheet';

export const Destinations = observer(() => {
  const navSheetStore = useNavSheetStore();
  const navSheetController = useNavSheetController();
  return (
    <DestinationMarkers
      destinations={navSheetStore.destinations}
      selectedDestinationNodeUid={navSheetStore.selectedDestination?.nodeUid}
      forceDisplay={navSheetStore.currentPageKey === NavPageKey.DESTINATIONS}
      onDestinationClick={action(dest =>
        navSheetController.onDestinationRoutesClick(dest),
      )}
    />
  );
});

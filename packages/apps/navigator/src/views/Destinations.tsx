import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DestinationMarkers } from '../components/DestinationMarkers';
import { NavPageKey } from '../controllers/constants';
import type { NavSheetController } from '../controllers/types';
import { useNavSheetStore } from '../stores/hooks/use-nav-sheet';

export const Destinations = observer(
  (props: { navSheetController: NavSheetController }) => {
    const navSheetStore = useNavSheetStore();
    return (
      <DestinationMarkers
        destinations={navSheetStore.destinations}
        selectedDestinationNodeUid={navSheetStore.selectedDestination?.nodeUid}
        forceDisplay={navSheetStore.currentPageKey === NavPageKey.DESTINATIONS}
        onDestinationClick={action(dest =>
          props.navSheetController.onDestinationRoutesClick(dest),
        )}
      />
    );
  },
);

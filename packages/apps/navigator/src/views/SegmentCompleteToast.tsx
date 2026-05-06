import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { SegmentCompleteToast as SegmentCompleteToastComponent } from '../components/SegmentCompleteToast';
import type { AppControllerImpl } from '../controllers/app';
import { useRouteStore } from '../stores/hooks/use-route';

export const SegmentCompleteToast = observer(
  (props: { controller: AppControllerImpl }) => {
    const route = useRouteStore();
    if (route.segmentComplete == null) {
      return <></>;
    }
    return (
      <SegmentCompleteToastComponent
        open={true}
        place={route.segmentComplete.place}
        placeInfo={route.segmentComplete.placeInfo}
        isFinalSegment={route.segmentComplete.isFinal}
        onContinueClick={action(() => props.controller.unpauseRouteEvents())}
        onEndClick={action(() => {
          props.controller.unpauseRouteEvents();
          props.controller.setActiveRoute(undefined);
        })}
      />
    );
  },
);

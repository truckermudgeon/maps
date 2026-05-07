import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { SegmentCompleteToast as SegmentCompleteToastComponent } from '../components/SegmentCompleteToast';
import { useAppController } from '../services/context';
import { useRouteStore } from '../stores/hooks/use-route';

export const SegmentCompleteToast = observer(() => {
  const route = useRouteStore();
  const controller = useAppController();
  if (route.segmentComplete == null) {
    return <></>;
  }
  return (
    <SegmentCompleteToastComponent
      open={true}
      place={route.segmentComplete.place}
      placeInfo={route.segmentComplete.placeInfo}
      isFinalSegment={route.segmentComplete.isFinal}
      onContinueClick={action(() => controller.unpauseRouteEvents())}
      onEndClick={action(() => {
        controller.unpauseRouteEvents();
        controller.setActiveRoute(undefined);
      })}
    />
  );
});

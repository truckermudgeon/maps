import { observer } from 'mobx-react-lite';
import { SegmentCompleteToast as SegmentCompleteToastComponent } from '../components/SegmentCompleteToast';
import { useRouteStore } from '../stores/hooks/use-route';

export const SegmentCompleteToast = observer(
  (props: { onContinue: () => void; onEnd: () => void }) => {
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
        onContinueClick={props.onContinue}
        onEndClick={props.onEnd}
      />
    );
  },
);

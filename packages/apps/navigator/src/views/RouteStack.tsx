import { RouteStack as RouteStackComponent } from '../components/RouteStack';
import { Directions } from './Directions';
import { RouteControls } from './RouteControls';
import { SegmentCompleteToast } from './SegmentCompleteToast';

export const RouteStack = () => (
  <RouteStackComponent
    Guidance={Directions}
    RouteControls={RouteControls}
    SegmentCompleteToast={SegmentCompleteToast}
  />
);

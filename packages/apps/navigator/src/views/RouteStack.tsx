import { RouteStack as RouteStackComponent } from '../components/RouteStack';
import type { RouteControlsCallbacks } from '../create-app-handlers';
import { Directions } from './Directions';
import { RouteControls } from './RouteControls';
import { SegmentCompleteToast } from './SegmentCompleteToast';

export const RouteStack = (props: {
  routeControlsCallbacks: RouteControlsCallbacks;
}) => (
  <RouteStackComponent
    Guidance={Directions}
    RouteControls={({ onExpandedToggle }) => (
      <RouteControls
        callbacks={props.routeControlsCallbacks}
        onExpandedToggle={onExpandedToggle}
      />
    )}
    SegmentCompleteToast={SegmentCompleteToast}
  />
);

import { RouteStack as RouteStackComponent } from '../components/RouteStack';
import type { AppControllerImpl } from '../controllers/app';
import type { RouteControlsCallbacks } from '../create-app-handlers';
import { Directions } from './Directions';
import { RouteControls } from './RouteControls';
import { SegmentCompleteToast } from './SegmentCompleteToast';

export const RouteStack = (props: {
  controller: AppControllerImpl;
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
    SegmentCompleteToast={() => (
      <SegmentCompleteToast controller={props.controller} />
    )}
  />
);

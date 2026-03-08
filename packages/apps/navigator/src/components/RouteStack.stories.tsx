import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WithLaneHint } from './Directions.stories';
import { RouteControls } from './RouteControls';
import { Default as RouteControlsDefault } from './RouteControls.stories';
import { NotFinalSegment } from './SegmentCompleteToast.stories';

import { Directions } from './Directions';
import { RouteStack } from './RouteStack';
import { SegmentCompleteToast } from './SegmentCompleteToast';

const meta = {
  title: 'Route/RouteStack',
  component: RouteStack,
  decorators: [
    (Story: () => React.JSX.Element) => (
      <div style={{ backgroundColor: '#f888', maxWidth: 600, height: '90vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RouteStack>;

export default meta;
type Story = StoryObj<typeof meta>;

const eventHandlers = {
  onSearchAlongRouteClick: fn(),
  onRoutePreviewClick: fn(),
  onRouteDirectionsClick: fn(),
  onRouteEndClick: fn(),
};

export const Default: Story = {
  args: {
    Guidance: () => <Directions {...WithLaneHint.args} />,
    RouteControls: props => (
      <RouteControls
        {...RouteControlsDefault.args}
        onExpandedToggle={props.onExpandedToggle}
      />
    ),
    SegmentCompleteToast: () => <></>,
    ...eventHandlers,
  },
};

export const WithSegmentCompleteToast: Story = {
  args: {
    Guidance: () => <Directions {...WithLaneHint.args} />,
    RouteControls: props => (
      <RouteControls
        {...RouteControlsDefault.args}
        onExpandedToggle={props.onExpandedToggle}
      />
    ),
    SegmentCompleteToast: () => (
      <SegmentCompleteToast {...NotFinalSegment.args} />
    ),
    ...eventHandlers,
  },
};

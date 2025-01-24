import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import 'maplibre-gl/dist/maplibre-gl.css';
import React from 'react';
import { SlippyMap } from './SlippyMap';

const meta = {
  title: 'Map/Slippy Map',
  component: SlippyMap,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SlippyMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    center: [-114.806, 36.282],
    onLoad: () => console.log('map loaded'),
    onDragStart: fn(),
    Destinations: () => <div />,
    TrailerOrWaypointMarkers: () => <div />,
    PlayerMarker: React.forwardRef((_, ref) =>
      React.createElement('div', { ref }),
    ),
  },
  render: (args, context) => (
    <SlippyMap {...args} mode={context.globals['theme'] as 'light' | 'dark'} />
  ),
};

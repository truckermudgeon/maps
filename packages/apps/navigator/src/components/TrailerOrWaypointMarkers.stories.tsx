import type { Meta, StoryContext, StoryObj } from '@storybook/react';
import * as React from 'react';
import { SlippyMap } from './SlippyMap';
import { Default as SlippyMapDefault } from './SlippyMap.stories';
import { TrailerOrWaypointMarkers } from './TrailerOrWaypointMarkers';

const meta = {
  title: 'Map/Trailer or Waypoint Markers',
  component: TrailerOrWaypointMarkers,
  decorators: [
    (Story: () => React.JSX.Element, context: StoryContext) => (
      <SlippyMap
        {...SlippyMapDefault.args}
        mode={context.globals['theme'] as 'light' | 'dark'}
        TrailerOrWaypointMarkers={Story}
      />
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TrailerOrWaypointMarkers>;

export default meta;
type Story = StoryObj<typeof meta>;

const fakeLat = 36.282;
const fakeLon = -114.806;

export const NoStops: Story = {
  args: {
    trailerPoint: undefined,
    activeRoute: {
      id: '',
      segments: [
        {
          key: '',
          lonLats: [
            [fakeLon, fakeLat],
            [fakeLon + 1, fakeLat + 1],
          ],
          distance: 0,
          time: 0,
          strategy: 'shortest',
        },
      ],
    },
  },
};

export const WithStops: Story = {
  args: {
    trailerPoint: undefined,
    activeRoute: {
      id: 'id',
      segments: [
        {
          key: '',
          lonLats: [
            [fakeLon, fakeLat],
            [fakeLon + 0.5, fakeLat - 0.3],
          ],
          distance: 0,
          time: 0,
          strategy: 'shortest',
        },
        {
          key: '',
          lonLats: [
            [fakeLon + 0.5, fakeLat - 0.3],
            [fakeLon + 0.7, fakeLat + 0.5],
          ],
          distance: 0,
          time: 0,
          strategy: 'shortest',
        },
        {
          key: '',
          lonLats: [
            [fakeLon + 0.7, fakeLat + 0.5],
            [fakeLon + 1, fakeLat + 1],
          ],
          distance: 0,
          time: 0,
          strategy: 'shortest',
        },
      ],
    },
  },
};

export const Trailer: Story = {
  args: {
    trailerPoint: [fakeLon, fakeLat],
    activeRoute: undefined,
  },
};

import type { Meta, StoryContext, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import * as React from 'react';
import { DestinationMarkers } from './DestinationMarkers';
import { SlippyMap } from './SlippyMap';
import { Default as SlippyMapDefault } from './SlippyMap.stories';
import { aSearchResultWith } from './story-builders';

const meta = {
  title: 'Map/Destination Markers',
  component: DestinationMarkers,
  decorators: [
    (Story: () => React.JSX.Element, context: StoryContext) => (
      <SlippyMap
        {...SlippyMapDefault.args}
        mode={context.globals['theme'] as 'light' | 'dark'}
        Destinations={Story}
      />
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof DestinationMarkers>;

export default meta;
type Story = StoryObj<typeof meta>;

const fakeLat = 36.282;
const fakeLon = -114.806;

export const Default: Story = {
  args: {
    destinations: Array.from({ length: 10 }, (_, i) =>
      aSearchResultWith({
        nodeUid: i.toString(),
        lonLat: [fakeLon + Math.random(), fakeLat + Math.random()],
      }),
    ),
    selectedDestinationNodeUid: undefined,
    forceDisplay: true,
    onDestinationClick: fn(),
  },
};

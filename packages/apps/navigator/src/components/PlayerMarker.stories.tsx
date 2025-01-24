import type { Meta, StoryContext, StoryObj } from '@storybook/react';
import * as React from 'react';
import { PlayerMarker } from './PlayerMarker';
import { SlippyMap } from './SlippyMap';
import { Default as SlippyMapDefault } from './SlippyMap.stories';

const meta = {
  title: 'Map/Player Marker',
  component: PlayerMarker,
  decorators: [
    (Story: () => React.JSX.Element, context: StoryContext) => (
      <SlippyMap
        {...SlippyMapDefault.args}
        mode={context.globals['theme']}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        PlayerMarker={Story}
      />
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof PlayerMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

const fakeLat = 36.282;
const fakeLon = -114.806;

export const Default: Story = {
  args: {
    longitude: fakeLon,
    latitude: fakeLat,
  },
};

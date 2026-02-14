import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CollapsibleButtonBar } from './CollapsibleButtonBar';
import { Hidden, Visible } from './CollapsibleButtonBar.stories';
import { DestinationItem } from './DestinationItem';
import { aSearchResultWith } from './story-builders';

const meta = {
  title: 'Search/Destination Item',
  component: DestinationItem,
} satisfies Meta<typeof DestinationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    destination: {
      ...aSearchResultWith({
        type: 'serviceArea',
        label: 'Cool Destination',
        sprite: 'hau_oil_gst',
        facilityUrls: ['/icons/gas_ico.png', 'icons/service_ico.png'],
      }),
      distance: 1234,
      bearing: 125,
    },
    index: 0,
    onDestinationHighlight: fn(),
    CollapsibleButtonBar: () => <CollapsibleButtonBar {...Visible.args} />,
  },
};

export const Unselected: Story = {
  args: {
    ...Selected.args,
    CollapsibleButtonBar: () => <CollapsibleButtonBar {...Hidden.args} />,
  },
};

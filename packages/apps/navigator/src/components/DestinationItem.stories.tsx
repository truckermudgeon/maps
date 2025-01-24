import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CollapsibleButtonBar } from './CollapsibleButtonBar';
import { Hidden, Visible } from './CollapsibleButtonBar.stories';
import { DestinationItem } from './DestinationItem';

const meta = {
  title: 'Search/Destination Item',
  component: DestinationItem,
} satisfies Meta<typeof DestinationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    destination: {
      nodeUid: 'nodeUid',
      lonLat: [1, 2],
      distanceMeters: 1234,
      bearing: 125,
      name: 'Cool Destination',
      logoUrl: '/icons/hau_oil_gst.png',
      city: 'City',
      state: 'NV',
      isCityStateApproximate: false,
      facilityUrls: ['/icons/gas_ico.png', 'icons/service_ico.png'],
    },
    index: 0,
    onDestinationHighlight: fn(),
    CollapsibleButtonBar: () => <CollapsibleButtonBar {...Visible.args} />,
  },
};

export const Unselected: Story = {
  args: {
    destination: {
      nodeUid: 'nodeUid',
      lonLat: [1, 2],
      distanceMeters: 1234,
      bearing: 125,
      name: 'Cool Destination',
      logoUrl: '/icons/hau_oil_gst.png',
      city: 'City',
      state: 'NV',
      isCityStateApproximate: false,
      facilityUrls: ['/icons/gas_ico.png', 'icons/service_ico.png'],
    },
    index: 0,
    onDestinationHighlight: fn(),
    CollapsibleButtonBar: () => <CollapsibleButtonBar {...Hidden.args} />,
  },
};

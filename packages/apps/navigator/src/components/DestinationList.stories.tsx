import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CollapsibleButtonBar } from './CollapsibleButtonBar';
import { Hidden } from './CollapsibleButtonBar.stories';
import { Selected, Unselected } from './DestinationItem.stories';
import { DestinationList } from './DestinationList';

const meta = {
  title: 'Search/Destination List',
  component: DestinationList,
} satisfies Meta<typeof DestinationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    destinations: [
      { ...Selected.args.destination, nodeUid: '1' },
      { ...Unselected.args.destination, nodeUid: '2' },
    ],
    onDestinationHighlight: fn(),
    CollapsibleButtonBar: () => <CollapsibleButtonBar {...Hidden.args} />,
  },
};

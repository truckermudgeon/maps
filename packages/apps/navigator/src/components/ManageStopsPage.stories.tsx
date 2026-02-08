import { arrayMove } from '@dnd-kit/sortable';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useState } from 'react';

import { ManageStopsPage } from './ManageStopsPage';

const meta = {
  component: ManageStopsPage,
} satisfies Meta<typeof ManageStopsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

// BigInts can't be serialized to JSON in storybook UI, so use Numbers instead
// (and just cast them to bigints).
const asBigInt = (n: number): bigint => n as unknown as bigint;

export const Default: Story = {
  args: {
    summary: {
      minutes: 1234,
      distanceMeters: 1234,
    },
    waypoints: [
      {
        id: 'a',
        description: 'Gallon Oil Gas Station',
        nodeUid: asBigInt(0),
      },
      {
        id: 'b',
        description: 'Peterbilt Dealer',
        nodeUid: asBigInt(1),
      },
      { id: 'c', description: 'Reno, NV', nodeUid: asBigInt(3) },
      { id: 'd', description: 'Wallbert', nodeUid: asBigInt(4) },
    ],
    onDoneClick: fn(),
    onWaypointReorder: fn(),
    onWaypointDelete: fn(),
  },
  render: args => {
    const [waypoints, setWaypoints] = useState(args.waypoints);
    const onWaypointReorder = (op: { oldIndex: number; newIndex: number }) => {
      setWaypoints(arrayMove(waypoints, op.oldIndex, op.newIndex));
      args.onWaypointReorder(op);
    };
    const onWaypointDelete = (index: number) => {
      waypoints.splice(index, 1);
      setWaypoints(waypoints.slice(0));
      args.onWaypointDelete(index);
    };
    return (
      <ManageStopsPage
        {...args}
        waypoints={waypoints}
        onWaypointReorder={onWaypointReorder}
        onWaypointDelete={onWaypointDelete}
      />
    );
  },
};

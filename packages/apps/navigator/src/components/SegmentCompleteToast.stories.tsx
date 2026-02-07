import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { SegmentCompleteToast } from './SegmentCompleteToast';

const meta = {
  title: 'Route/SegmentCompleteToast',
  component: SegmentCompleteToast,
} satisfies Meta<typeof SegmentCompleteToast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotFinalSegment: Story = {
  args: {
    open: true,
    place: 'Company Name',
    placeInfo: 'near Some City, ST',
    isFinalSegment: false,
    onContinueClick: fn(),
    onEndClick: fn(),
  },
};

export const FinalSegment: Story = {
  args: {
    ...NotFinalSegment.args,
    isFinalSegment: true,
  },
};

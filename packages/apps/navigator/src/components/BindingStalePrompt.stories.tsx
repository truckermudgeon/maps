import { Card } from '@mui/joy';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { BindingStalePrompt } from './BindingStalePrompt';

const meta = {
  title: 'Session/BindingStalePrompt',
  component: BindingStalePrompt,
  decorators: [
    Story => (
      <Card size={'lg'} sx={{ maxWidth: '40ch' }}>
        <Story />
      </Card>
    ),
  ],
} satisfies Meta<typeof BindingStalePrompt>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onRePair: fn(),
  },
};

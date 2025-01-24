import type { Meta, StoryObj } from '@storybook/react';
import { NavSheet } from './NavSheet';
import { TitleControls } from './TitleControls';
import { Default as DefaultTitleControls } from './TitleControls.stories';

const meta = {
  title: 'Search/Nav Sheet',
  component: NavSheet,
} satisfies Meta<typeof NavSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    TitleControls: () => <TitleControls {...DefaultTitleControls.args} />,
    CurrentPage: () => <div>Current Page Content</div>,
  },
};

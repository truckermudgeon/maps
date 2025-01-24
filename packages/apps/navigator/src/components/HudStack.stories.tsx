import type { Meta, StoryObj } from '@storybook/react';
import { Fab } from './Fab';
import { Plain, Solid } from './Fab.stories';
import { HudStack } from './HudStack';
import { SpeedLimit } from './SpeedLimit';
import { Primary as SpeedLimitPrimary } from './SpeedLimit.stories';
import { TextCompass } from './TextCompass';
import { TwoLetter as TextCompassPrimary } from './TextCompass.stories';

const meta = {
  title: 'HUD/Control Stack',
  component: HudStack,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof HudStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    Direction: () => <TextCompass {...TextCompassPrimary.args} />,
    SpeedLimit: () => <SpeedLimit {...SpeedLimitPrimary.args} />,
    RecenterFab: () => <Fab {...Plain.args} />,
    RouteFab: () => <Fab {...Solid.args} />,
    SearchFab: () => <Fab {...Solid.args} />,
  },
};

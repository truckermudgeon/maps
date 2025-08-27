import type { Meta, StoryContext, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Fab } from './Fab';
import { Plain, Solid } from './Fab.stories';
import { HudStack } from './HudStack';
import { SpeedLimit } from './SpeedLimit';
import {
  KPH as KphSpeedLimit,
  MPHWithNormalSpeed as MphSpeedLimit,
} from './SpeedLimit.stories';
import { TextCompass } from './TextCompass';
import { TwoLetter as TextCompassPrimary } from './TextCompass.stories';

const meta = {
  title: 'HUD/Control Stack',
  component: HudStack,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story: () => React.JSX.Element, context: StoryContext) => (
      <div
        style={{
          width: '100vh',
          height: '100vh',
          backgroundColor:
            context.globals['theme'] === 'dark' ? '#1a1a1a' : '#f8f8f8',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HudStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MPH: Story = {
  args: {
    Direction: () => <TextCompass {...TextCompassPrimary.args} />,
    SpeedLimit: () => <SpeedLimit {...MphSpeedLimit.args} />,
    RecenterFab: () => <Fab {...Plain.args} />,
    RouteFab: () => <Fab {...Solid.args} />,
    SearchFab: () => <Fab {...Solid.args} />,
  },
};

export const KPH: Story = {
  args: {
    Direction: () => <TextCompass {...TextCompassPrimary.args} />,
    SpeedLimit: () => <SpeedLimit {...KphSpeedLimit.args} />,
    RecenterFab: () => <Fab {...Plain.args} />,
    RouteFab: () => <Fab {...Solid.args} />,
    SearchFab: () => <Fab {...Solid.args} />,
  },
};

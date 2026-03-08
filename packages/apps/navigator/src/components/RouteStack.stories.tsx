import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { Directions } from './Directions';
import './Directions.css';
import { WithLaneHint, WithNameText } from './Directions.stories';
import { RouteControls } from './RouteControls';
import { Default as RouteControlsDefault } from './RouteControls.stories';
import { RouteStack } from './RouteStack';
import { SegmentCompleteToast } from './SegmentCompleteToast';
import { NotFinalSegment } from './SegmentCompleteToast.stories';

const meta = {
  title: 'Route/RouteStack',
  component: RouteStack,
  decorators: [
    (Story: () => React.JSX.Element) => (
      <div style={{ backgroundColor: '#f888', maxWidth: 600, height: '90vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RouteStack>;

export default meta;
type Story = StoryObj<typeof meta>;

const eventHandlers = {
  onSearchAlongRouteClick: fn(),
  onRoutePreviewClick: fn(),
  onRouteDirectionsClick: fn(),
  onRouteEndClick: fn(),
};

class DirectionStore {
  props = WithLaneHint.args;

  constructor() {
    makeAutoObservable(this);
  }
}

const store = new DirectionStore();

setTimeout(() => {
  runInAction(() => (store.props = WithNameText.args));
}, 2_000);

const _Directions = observer(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const directionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return reaction(
      () => store.props,
      () => {
        const container = containerRef.current;
        const current = directionsRef.current;
        if (!container || !current) {
          return;
        }

        const outgoingClone = current.cloneNode(true) as HTMLDivElement;
        current.classList.add('enter');
        current.classList.add('directions');

        container.appendChild(outgoingClone);
        container.classList.add('animate');
        outgoingClone.style.top = -current.clientHeight + 'px';

        requestAnimationFrame(() => {
          outgoingClone.classList.add('exit');
          outgoingClone.classList.add('directions');
          outgoingClone.style.top = -current.clientHeight + 'px';
        });

        const cleanup = () => {
          container.classList.remove('animate');
          outgoingClone.remove();
        };

        setTimeout(cleanup, 200);
      },
    );
  }, []);

  return (
    <div ref={containerRef} className={'container'}>
      <Directions ref={directionsRef} {...store.props} />
    </div>
  );
});

export const Default: Story = {
  args: {
    Guidance: _Directions,
    RouteControls: props => (
      <RouteControls
        {...RouteControlsDefault.args}
        onExpandedToggle={props.onExpandedToggle}
      />
    ),
    SegmentCompleteToast: () => <></>,
    ...eventHandlers,
  },
};

export const WithSegmentCompleteToast: Story = {
  args: {
    Guidance: () => <Directions {...WithLaneHint.args} />,
    RouteControls: props => (
      <RouteControls
        {...RouteControlsDefault.args}
        onExpandedToggle={props.onExpandedToggle}
      />
    ),
    SegmentCompleteToast: () => (
      <SegmentCompleteToast {...NotFinalSegment.args} />
    ),
    ...eventHandlers,
  },
};

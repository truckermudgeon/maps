import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import type { AppStore } from '../controllers/types';
import { Directions } from './Directions';
import './Directions.css';
import {
  defaultImperialOptions,
  defaultMetricOptions,
  toLengthAndUnit,
} from './text';

export const AnimatedDirections = observer((props: { store: AppStore }) => {
  const { store } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const directionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return reaction(
      () => store.activeRouteDirection,
      maybeDirection => {
        if (!maybeDirection) {
          return;
        }

        const container = containerRef.current;
        const current = directionsRef.current;
        if (!container || !current) {
          return;
        }

        const outgoingClone = current.cloneNode(true) as HTMLDivElement;
        current.classList.add('enter', 'directions');

        container.appendChild(outgoingClone);
        container.classList.add('animate');
        outgoingClone.style.top = -current.clientHeight + 'px';

        requestAnimationFrame(() => {
          outgoingClone.classList.add('exit', 'directions');
          outgoingClone.style.top = -current.clientHeight + 'px';
        });

        const cleanup = () => {
          container.classList.remove('animate');
          current.classList.remove('enter', 'directions');
          outgoingClone.remove();
        };

        setTimeout(cleanup, 200);
      },
    );
  }, [store]);

  if (!store.activeRouteDirection) {
    return <></>;
  }

  const { length, unit } = toLengthAndUnit(
    store.distanceToNextManeuver,
    store.map === 'usa' ? defaultImperialOptions : defaultMetricOptions,
  );

  return (
    <div ref={containerRef} className={'container'}>
      <Directions
        ref={directionsRef}
        direction={store.activeRouteDirection.direction}
        length={length}
        unit={unit}
        laneHint={
          store.distanceToNextManeuver <= 5_000
            ? store.activeRouteDirection.laneHint
            : undefined
        }
        thenHint={
          !store.activeRouteDirection.laneHint ||
          store.distanceToNextManeuver > 5_000
            ? store.activeRouteDirection.thenHint
            : undefined
        }
        banner={store.activeRouteDirection.banner}
      />
    </div>
  );
});

import type { StepManeuver } from '@truckermudgeon/navigation/types';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Directions } from './Directions';
import './Directions.css';
import {
  defaultImperialOptions,
  defaultMetricOptions,
  toLengthAndUnit,
} from './text';

interface AnimatedDirectionsProps {
  direction: StepManeuver | undefined;
  distanceToNextManeuver: number;
  units: 'imperial' | 'metric';
}

const ANIMATION_DURATION_MS = 200;

export const AnimatedDirections = (props: AnimatedDirectionsProps) => {
  const { direction, distanceToNextManeuver, units } = props;
  const [outgoing, setOutgoing] = useState<StepManeuver | undefined>();
  const [exitActive, setExitActive] = useState(false);
  const prevDirectionRef = useRef(direction);
  const currentRef = useRef<HTMLDivElement>(null);
  const outgoingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = prevDirectionRef.current;
    prevDirectionRef.current = direction;

    if (!prev || !direction || prev === direction) {
      return;
    }

    setOutgoing(prev);
    setExitActive(false);

    const rafId = requestAnimationFrame(() => setExitActive(true));
    const timeoutId = setTimeout(() => {
      setOutgoing(undefined);
      setExitActive(false);
    }, ANIMATION_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [direction]);

  // Pull the outgoing element up onto the current one — they share the
  // container and would otherwise stack vertically.
  useLayoutEffect(() => {
    const current = currentRef.current;
    const outgoingEl = outgoingRef.current;
    if (current && outgoingEl) {
      outgoingEl.style.top = `${-current.clientHeight}px`;
    }
  }, [outgoing]);

  if (!direction && !outgoing) {
    return <></>;
  }

  const animate = outgoing != null;
  const { length, unit } = toLengthAndUnit(
    distanceToNextManeuver,
    units === 'imperial' ? defaultImperialOptions : defaultMetricOptions,
  );

  const buildProps = (step: StepManeuver) => {
    const showLaneHint = distanceToNextManeuver <= 5_000;
    return {
      direction: step.direction,
      length,
      unit,
      banner: step.banner,
      laneHint: showLaneHint ? step.laneHint : undefined,
      thenHint: showLaneHint && step.laneHint ? undefined : step.thenHint,
    };
  };

  return (
    <div className={animate ? 'container animate' : 'container'}>
      {direction && (
        <Directions
          ref={currentRef}
          className={animate ? 'directions enter' : undefined}
          {...buildProps(direction)}
        />
      )}
      {outgoing && (
        <Directions
          ref={outgoingRef}
          className={exitActive ? 'directions exit' : 'directions'}
          {...buildProps(outgoing)}
        />
      )}
    </div>
  );
};

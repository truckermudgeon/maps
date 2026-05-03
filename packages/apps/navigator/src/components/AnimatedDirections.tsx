import type { StepManeuver } from '@truckermudgeon/navigation/types';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Directions } from './Directions';
import './Directions.css';
import {
  defaultImperialOptions,
  defaultMetricOptions,
  toLengthAndUnit,
} from './text';

export interface AnimatedDirectionsProps {
  direction: StepManeuver | undefined;
  distanceToNextManeuver: number;
  units: 'imperial' | 'metric';
}

const ANIMATION_DURATION_MS = 200;

const toDirectionsProps = (
  step: StepManeuver,
  distance: number,
  units: 'imperial' | 'metric',
) => {
  const { length, unit } = toLengthAndUnit(
    distance,
    units === 'imperial' ? defaultImperialOptions : defaultMetricOptions,
  );
  const showLaneHint = distance <= 5_000;
  return {
    direction: step.direction,
    length,
    unit,
    banner: step.banner,
    laneHint: showLaneHint ? step.laneHint : undefined,
    thenHint: showLaneHint && step.laneHint ? undefined : step.thenHint,
  };
};

export const AnimatedDirections = (props: AnimatedDirectionsProps) => {
  const { direction, distanceToNextManeuver, units } = props;
  const [outgoing, setOutgoing] = useState<AnimatedDirectionsProps>();
  const [exitActive, setExitActive] = useState(false);
  const prevPropsRef = useRef(props);
  const currentRef = useRef<HTMLDivElement>(null);
  const outgoingRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect (not useEffect) so the snapshot + extra render happen
  // before the browser paints. Otherwise there is a single-frame flash where
  // the new direction sits at the natural position with no animation classes.
  useLayoutEffect(() => {
    const prev = prevPropsRef.current;

    if (!prev.direction || !direction || prev.direction === direction) {
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

  // Capture each render's props so the next direction change has access to
  // the previous render's values for the outgoing snapshot. Declared after
  // the direction effect so the direction effect always reads stale (pre-
  // change) values from the ref.
  useEffect(() => {
    prevPropsRef.current = props;
  });

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

  return (
    <div className={animate ? 'container animate' : 'container'}>
      {direction && (
        <Directions
          ref={currentRef}
          className={animate ? 'directions enter' : undefined}
          {...toDirectionsProps(direction, distanceToNextManeuver, units)}
        />
      )}
      {outgoing?.direction && (
        <Directions
          ref={outgoingRef}
          className={exitActive ? 'directions exit' : 'directions'}
          {...toDirectionsProps(
            outgoing.direction,
            outgoing.distanceToNextManeuver,
            outgoing.units,
          )}
        />
      )}
    </div>
  );
};

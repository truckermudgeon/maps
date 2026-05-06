import type { Route, RouteStep } from '@truckermudgeon/navigation/types';

export function getNextStep(
  step: RouteStep,
  route: Route,
): RouteStep | undefined {
  const allSteps = route.segments.flatMap(segment => segment.steps);
  const index = allSteps.indexOf(step);
  if (index === -1) {
    return undefined;
  }
  return allSteps[index + 1];
}

export interface RouteSummaryAcc {
  duration: number;
  distanceMeters: number;
  activeRouteNodeIndex: number;
}

/**
 * Reducer over a step array that accumulates duration (seconds) and
 * distanceMeters. The initial accumulator must include
 * `activeRouteNodeIndex` — the truck's current node within the first
 * step in the array — so that step contributes only the portion still
 * ahead of the truck. Subsequent steps contribute in full.
 */
export const routeSummaryReducer = (
  acc: RouteSummaryAcc,
  step: RouteStep,
  stepIndex: number,
): RouteSummaryAcc => {
  const stepFraction =
    stepIndex === 0
      ? (step.nodesTraveled - acc.activeRouteNodeIndex) / step.nodesTraveled
      : 1;

  // Arrival steps can have nodesTraveled === 0 → NaN/Infinity from the
  // divide above; reset to 0 so they don't poison running totals.
  let dDuration = step.duration * stepFraction;
  if (isNaN(dDuration) || !isFinite(dDuration)) {
    dDuration = 0;
  }
  let dDistance = step.distanceMeters * stepFraction;
  if (isNaN(dDistance) || !isFinite(dDistance)) {
    dDistance = 0;
  }

  acc.duration += dDuration;
  acc.distanceMeters += dDistance;
  return acc;
};

import type { RouteWithSummary } from '@truckermudgeon/navigation/types';
import { toLengthAndUnit } from './components/text';

type ToLengthAndUnitOptions = Parameters<typeof toLengthAndUnit>[1];

export function sortedRoutePreviewIndices(
  routes: readonly RouteWithSummary[],
  selectedRoute: { id: string } | undefined,
): number[] {
  const highlightedIndex = routes.findIndex(r => r.id === selectedRoute?.id);
  return [0, 1, 2].sort((a, b) =>
    a === highlightedIndex ? 1 : b === highlightedIndex ? -1 : a - b,
  );
}

export function toRouteSummary(
  s: { distanceMeters: number; minutes: number } | undefined,
  options: ToLengthAndUnitOptions,
): { minutes: number; distance: ReturnType<typeof toLengthAndUnit> } {
  return {
    minutes: s?.minutes ?? 0,
    distance: toLengthAndUnit(s?.distanceMeters ?? 0, options),
  };
}

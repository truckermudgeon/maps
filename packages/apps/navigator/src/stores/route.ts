import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type {
  Route,
  RouteIndex,
  RouteStep,
  SegmentInfo,
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import { lineString } from '@turf/helpers';
import { length } from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { makeAutoObservable, observable } from 'mobx';
import { getNextStep, routeSummaryReducer } from '../util/route-geometry';
import type { ActiveStepLine, RouteStore, RouteSummary } from './types';

export class RouteStoreImpl implements RouteStore {
  activeRoute: Route | undefined = undefined;
  activeRouteIndex: RouteIndex | undefined = undefined;
  truckPoint: [lon: number, lat: number] = [0, 0];
  trailerPoint: [lon: number, lat: number] | undefined;
  segmentComplete: SegmentInfo | undefined = undefined;

  constructor() {
    makeAutoObservable(this, {
      activeRoute: observable.ref,
      activeRouteIndex: observable.struct,
      truckPoint: observable.ref,
      trailerPoint: observable.ref,
      segmentComplete: observable.ref,
    });
  }

  private get activeStep(): RouteStep | undefined {
    // activeRoute and activeRouteIndex can get out of sync. Treat undefined
    // activeRouteIndex as the signal and bail before computing a possibly-
    // invalid StepManeuver.
    if (!this.activeRoute || this.activeRouteIndex == null) {
      return undefined;
    }
    const { segmentIndex, stepIndex } = this.activeRouteIndex;
    return assertExists(
      this.activeRoute.segments[segmentIndex].steps[stepIndex],
    );
  }

  private get nextStep(): RouteStep | undefined {
    if (!this.activeRoute || !this.activeStep) {
      return;
    }
    return getNextStep(this.activeStep, this.activeRoute);
  }

  private get nextStepArrow():
    | { geometry: GeoJSON.Feature<GeoJSON.LineString>; length: number }
    | undefined {
    if (!this.nextStep?.arrowPoints) {
      return;
    }
    const arrowPoints = polyline
      .decode(this.nextStep.geometry)
      .slice(0, this.nextStep.arrowPoints);
    const arrow = lineString(arrowPoints);
    return {
      geometry: arrow,
      length: length(arrow),
    };
  }

  get activeStepLine(): ActiveStepLine | undefined {
    if (!this.activeStep) {
      return undefined;
    }
    const linePoints = polyline.decode(this.activeStep.geometry);
    const line = lineString(linePoints);
    let arrow;
    if (this.activeStep.arrowPoints) {
      const geometry = lineString(
        linePoints.slice(0, this.activeStep.arrowPoints),
      );
      arrow = {
        geometry,
        length: length(geometry),
      };
    }
    return {
      line,
      length: length(line),
      arrow,
    };
  }

  get activeRouteSummary(): RouteSummary | undefined {
    const firstWayPointSummary = this.activeRouteToFirstWayPointSummary;
    if (!firstWayPointSummary || !this.activeRoute || !this.activeRouteIndex) {
      return;
    }
    const restSegments = this.activeRoute.segments.slice(
      this.activeRouteIndex.segmentIndex + 1,
    );
    const restSegmentTotals = restSegments
      .flatMap(segment => segment.steps)
      .reduce(routeSummaryReducer, {
        duration: 0,
        distanceMeters: 0,
        activeRouteNodeIndex: this.activeRouteIndex.nodeIndex,
      });
    return {
      distanceMeters:
        firstWayPointSummary.distanceMeters + restSegmentTotals.distanceMeters,
      minutes:
        firstWayPointSummary.minutes +
        Math.ceil(restSegmentTotals.duration / 60),
    };
  }

  get activeRouteToFirstWayPointSummary(): RouteSummary | undefined {
    if (!this.activeRoute || !this.activeRouteIndex) {
      return;
    }
    const [firstSegment] = this.activeRoute.segments.slice(
      this.activeRouteIndex.segmentIndex,
    );
    const firstSegmentTotals = firstSegment.steps
      .slice(this.activeRouteIndex.stepIndex)
      .reduce(routeSummaryReducer, {
        duration: 0,
        distanceMeters: 0,
        activeRouteNodeIndex: this.activeRouteIndex.nodeIndex,
      });
    return {
      distanceMeters: firstSegmentTotals.distanceMeters,
      minutes: Math.ceil(firstSegmentTotals.duration / 60),
    };
  }

  get activeRouteDirection(): StepManeuver | undefined {
    if (!this.activeStepLine) {
      return;
    }
    const { line } = this.activeStepLine;
    if (isDegenerateLine(line)) {
      return undefined;
    }
    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    if (distanceAlongLineKm < (this.activeStepLine.arrow?.length ?? 0) / 2) {
      return this.activeStep?.maneuver;
    }
    return this.nextStep?.maneuver;
  }

  get distanceToNextManeuver(): number {
    if (!this.activeStepLine) {
      return 0;
    }
    const { line, length } = this.activeStepLine;
    if (isDegenerateLine(line)) {
      return 0;
    }
    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    const arrowMidpointLocation = (this.activeStepLine.arrow?.length ?? 0) / 2;
    if (distanceAlongLineKm < arrowMidpointLocation) {
      return ((arrowMidpointLocation - distanceAlongLineKm) * 1000) / 19.668;
    }
    return (
      ((length - distanceAlongLineKm + (this.nextStepArrow?.length ?? 0) / 2) *
        1000) /
      19.668
    );
  }

  get activeArrowStep(): RouteStep | undefined {
    if (!this.activeStepLine) {
      return;
    }
    const { line } = this.activeStepLine;
    if (isDegenerateLine(line)) {
      return undefined;
    }
    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    if (distanceAlongLineKm < (this.activeStepLine.arrow?.length ?? 0) / 2) {
      return this.activeStep!;
    }
    return this.nextStep!;
  }

  get geoJsonRoute(): {
    steps: readonly { step: RouteStep; featureLength: number }[];
    featureLength: number;
  } {
    if (!this.activeRoute) {
      return { steps: [], featureLength: 0 };
    }
    let totalLength = 0;
    const steps = this.activeRoute.segments.flatMap(s =>
      s.steps.map(step => {
        const points = polyline.decode(step.geometry);
        const stepLine = lineString(points);
        const featureLength = length(stepLine);
        totalLength += featureLength;
        return { step, featureLength };
      }),
    );
    return { steps, featureLength: totalLength };
  }
}

function isDegenerateLine(line: GeoJSON.Feature<GeoJSON.LineString>): boolean {
  const firstCoord = line.geometry.coordinates[0];
  return line.geometry.coordinates.every(
    pos => pos[0] === firstCoord[0] && pos[1] === firstCoord[1],
  );
}

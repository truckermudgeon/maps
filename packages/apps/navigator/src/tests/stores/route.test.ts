import polyline from '@mapbox/polyline';
import type {
  Route,
  RouteIndex,
  RouteStep,
} from '@truckermudgeon/navigation/types';
import { reaction, runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';
import { RouteStoreImpl } from '../../stores/route';

function step(overrides: Partial<RouteStep> = {}): RouteStep {
  return {
    duration: 60,
    distanceMeters: 1000,
    nodesTraveled: 10,
    geometry: polyline.encode([
      [37.7, -122.4],
      [37.71, -122.39],
      [37.72, -122.38],
    ]),
    arrowPoints: 0,
    maneuver: { lonLat: [-122.4, 37.7] } as RouteStep['maneuver'],
    ...overrides,
  } as RouteStep;
}

function route(stepsPerSegment: RouteStep[][]): Route {
  return {
    segments: stepsPerSegment.map((steps, i) => ({
      key: `seg-${i}`,
      steps,
    })),
  } as unknown as Route;
}

const idx = (overrides: Partial<RouteIndex> = {}): RouteIndex => ({
  segmentIndex: 0,
  stepIndex: 0,
  nodeIndex: 0,
  ...overrides,
});

describe('RouteStoreImpl', () => {
  describe('with no active route', () => {
    it.each([
      ['activeStepLine', undefined],
      ['activeRouteSummary', undefined],
      ['activeRouteToFirstWayPointSummary', undefined],
      ['activeRouteDirection', undefined],
      ['distanceToNextManeuver', 0],
      ['activeArrowStep', undefined],
    ] as const)('%s is %s', (key, expected) => {
      const s = new RouteStoreImpl();
      expect(s[key]).toEqual(expected);
    });

    it('geoJsonRoute returns empty', () => {
      const s = new RouteStoreImpl();
      expect(s.geoJsonRoute).toEqual({ steps: [], featureLength: 0 });
    });
  });

  describe('with an active route but no index', () => {
    // Pinned: when activeRoute is set but activeRouteIndex is undefined,
    // computeds bail rather than crash. The store is briefly out of sync
    // when a routeUpdate arrives ahead of the matching routeProgress.
    it('all step-derived computeds return their empty value', () => {
      const s = new RouteStoreImpl();
      runInAction(() => {
        s.activeRoute = route([[step()]]);
        s.activeRouteIndex = undefined;
      });
      expect(s.activeStepLine).toBeUndefined();
      expect(s.activeRouteSummary).toBeUndefined();
      expect(s.activeRouteDirection).toBeUndefined();
      expect(s.distanceToNextManeuver).toBe(0);
    });
  });

  describe('with an active route + index', () => {
    function setup() {
      const s = new RouteStoreImpl();
      runInAction(() => {
        s.activeRoute = route([
          [
            step({ duration: 100, distanceMeters: 1000, nodesTraveled: 10 }),
            step({ duration: 50, distanceMeters: 500, nodesTraveled: 5 }),
          ],
          [step({ duration: 30, distanceMeters: 300, nodesTraveled: 3 })],
        ]);
        s.activeRouteIndex = idx();
      });
      return s;
    }

    it('activeStepLine returns line and length', () => {
      const s = setup();
      const line = s.activeStepLine!;
      expect(line).toBeDefined();
      expect(line.line.geometry.type).toBe('LineString');
      expect(line.length).toBeGreaterThan(0);
      expect(line.arrow).toBeUndefined();
    });

    it('activeStepLine includes arrow when arrowPoints is set', () => {
      const s = new RouteStoreImpl();
      runInAction(() => {
        s.activeRoute = route([[step({ arrowPoints: 2 })]]);
        s.activeRouteIndex = idx();
      });
      expect(s.activeStepLine!.arrow).toBeDefined();
      expect(s.activeStepLine!.arrow!.length).toBeGreaterThan(0);
    });

    it('geoJsonRoute returns one entry per step across segments', () => {
      const s = setup();
      expect(s.geoJsonRoute.steps).toHaveLength(3);
      expect(s.geoJsonRoute.featureLength).toBeGreaterThan(0);
    });

    it('activeRouteToFirstWayPointSummary covers steps in segment 0 only', () => {
      const s = setup();
      const summary = s.activeRouteToFirstWayPointSummary!;
      // step 0 (full at nodeIndex 0): 100s + step 1 (full): 50s = 150s = 3min
      expect(summary.minutes).toBe(3);
      expect(summary.distanceMeters).toBeCloseTo(1500);
    });

    it('activeRouteSummary adds remaining segments to the first-waypoint total', () => {
      const s = setup();
      const total = s.activeRouteSummary!;
      // 150s (segment 0) + 30s (segment 1) = 180s = 3min, ceil(180/60)=3
      expect(total.minutes).toBe(3 + 1); // first-WP minutes (3) + ceil(30/60) = 4
      expect(total.distanceMeters).toBeCloseTo(1500 + 300);
    });

    it('activeRouteToFirstWayPointSummary uses partial fraction at index 0', () => {
      const s = new RouteStoreImpl();
      runInAction(() => {
        s.activeRoute = route([
          [step({ duration: 100, distanceMeters: 1000, nodesTraveled: 10 })],
        ]);
        s.activeRouteIndex = idx({ nodeIndex: 4 });
      });
      const summary = s.activeRouteToFirstWayPointSummary!;
      // (10 - 4) / 10 = 0.6 → 60s, 600m
      expect(summary.minutes).toBe(1);
      expect(summary.distanceMeters).toBeCloseTo(600);
    });
  });

  describe('reactivity', () => {
    it('reacts to activeRoute assignment', () => {
      const s = new RouteStoreImpl();
      let observedSteps = -1;
      const dispose = reaction(
        () => s.geoJsonRoute.steps.length,
        n => {
          observedSteps = n;
        },
        { fireImmediately: true },
      );
      expect(observedSteps).toBe(0);
      runInAction(() => {
        s.activeRoute = route([[step(), step()]]);
        s.activeRouteIndex = idx();
      });
      expect(observedSteps).toBe(2);
      dispose();
    });
  });
});

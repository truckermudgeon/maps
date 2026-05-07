import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Route, RouteStep } from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { GeoJSONSource } from 'maplibre-gl';
import { lineGradientExpression } from '../components/RoutesStyle';
import type { RouteStore } from '../stores/types';
import { clamp } from '../util/clamp';
import { toRouteFeatures } from '../util/route-features';
import type { MapAdapter } from './map-adapter';

const emptyFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const;

/**
 * Mutates map sources and paint properties to draw the active route,
 * the route preview list, the active step's progress gradient, and the
 * step-arrow on demand. Imperative API; callers fire render*() methods
 * when they decide to.
 */
export class RouteRenderer {
  private lastRenderedActiveStepLine:
    | GeoJSON.Feature<GeoJSON.LineString>
    | undefined;

  constructor(private readonly mapAdapter: MapAdapter) {}

  renderActiveRoute(maybeRoute: Route | undefined): void {
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const stepSource = assertExists(
      map.getSource<GeoJSONSource>('activeRouteStep'),
    );
    stepSource.setData(emptyFeatureCollection);
    this.lastRenderedActiveStepLine = undefined;

    const routeSource = assertExists(
      map.getSource<GeoJSONSource>('activeRoute'),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    routeSource.setData(toRouteFeatures(maybeRoute));
    this.toggleActiveRouteLayers(true);
  }

  renderRoutePreview(
    maybeRoute: Route | undefined,
    options: { highlight: boolean; index: number; animate: boolean },
  ): void {
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    console.log('rendering route preview');
    const routeSource = assertExists(
      map.getSource<GeoJSONSource>(`previewRoute-${options.index}`),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    routeSource.setData(toRouteFeatures(maybeRoute));
    if (options.animate) {
      // The line-gradient is animated via rAF so callers don't need to
      // think about animation pacing — just pass animate:true. This is
      // the documented exception to the otherwise-reactive render flow.
      let start = 0;
      const durationMs = 1_000;
      const animate = (timestamp: number) => {
        if (!start) {
          start = timestamp;
        }
        const t = (timestamp - start) / durationMs;
        const progress = Math.min(t, 1);
        map
          .getMap()
          .setPaintProperty(
            `previewRouteLayer-${options.index}`,
            'line-gradient',
            lineGradientExpression({
              lineType: options.highlight
                ? 'animatedPrimaryLine'
                : 'animatedSecondaryLine',
              progress,
            }),
          )
          .setPaintProperty(
            `previewRouteLayer-${options.index}-case`,
            'line-gradient',
            lineGradientExpression({
              lineType: options.highlight
                ? 'animatedPrimaryCase'
                : 'animatedSecondaryCase',
              progress,
            }),
          );
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }

    this.toggleActiveRouteLayers(false);
  }

  renderActiveRouteProgress(store: RouteStore): void {
    const map = this.mapAdapter.getMap();
    if (
      !map ||
      !store.activeRoute ||
      !store.activeRouteIndex ||
      !store.activeStepLine
    ) {
      return;
    }

    let distanceTraveled = 0;
    const activeStep =
      store.activeRoute.segments[store.activeRouteIndex.segmentIndex].steps[
        store.activeRouteIndex.stepIndex
      ];
    for (const { step, featureLength } of store.geoJsonRoute.steps) {
      if (step === activeStep) {
        break;
      }
      distanceTraveled += featureLength;
    }

    const snapPoint = nearestPointOnLine(
      store.activeStepLine.line,
      // cast as mutable, and assume nearestPointOnLine doesn't mutate.
      store.truckPoint as [number, number],
    );
    const distanceAlongActiveStepLine = snapPoint.properties.lineDistance;
    distanceTraveled += distanceAlongActiveStepLine;

    const stepSource = assertExists(
      map.getSource<GeoJSONSource>('activeRouteStep'),
    );
    if (this.lastRenderedActiveStepLine !== store.activeStepLine.line) {
      console.log('rendering step line');
      stepSource.setData(store.activeStepLine.line);
    }
    const stepProgress =
      distanceAlongActiveStepLine / store.activeStepLine.length;
    map
      .getMap()
      .setPaintProperty(
        `activeRouteStepLayer-case`,
        'line-gradient',
        lineGradientExpression({
          lineType: 'case',
          progress: stepProgress,
        }),
      )
      .setPaintProperty(
        'activeRouteStepLayer',
        'line-gradient',
        lineGradientExpression({
          lineType: 'line',
          progress: stepProgress,
        }),
      );

    this.lastRenderedActiveStepLine = store.activeStepLine.line;

    const progress = clamp(
      distanceTraveled / store.geoJsonRoute.featureLength,
      0,
      1,
    );
    map
      .getMap()
      .setPaintProperty(
        'activeRouteLayer-case',
        'line-gradient',
        lineGradientExpression({ lineType: 'case', progress }),
      )
      .setPaintProperty(
        'activeRouteLayer',
        'line-gradient',
        lineGradientExpression({ lineType: 'line', progress }),
      );
  }

  drawStepArrow(step: RouteStep | undefined): void {
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const arrowSource = assertExists(
      map.getSource<GeoJSONSource>('previewStepArrow'),
    );
    if (!step?.arrowPoints || step.arrowPoints < 2) {
      arrowSource.setData(emptyFeatureCollection);
      return;
    }

    const points = polyline.decode(step.geometry).slice(0, step.arrowPoints);
    const line = lineString(points);
    const bearingDegrees = bearing(points.at(-2)!, points.at(-1)!);
    const arrowHead = point(points.at(-1)!, { bearing: bearingDegrees });

    arrowSource.setData(
      featureCollection<GeoJSON.LineString | GeoJSON.Point>([line, arrowHead]),
    );
  }

  private toggleActiveRouteLayers(visible: boolean): void {
    const map = this.mapAdapter.getMap();
    if (!map) {
      return;
    }

    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    const visibility = visible ? 'visible' : 'none';
    map
      .getMap()
      .setLayoutProperty('activeRouteLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteLayer-case', 'visibility', visibility)
      .setLayoutProperty('activeRouteIconsLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStartLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer-case', 'visibility', visibility);
  }
}

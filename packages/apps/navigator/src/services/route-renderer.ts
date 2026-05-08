import polyline from '@mapbox/polyline';
import type { Route, RouteStep } from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { RouteStore } from '../stores/types';
import { clamp } from '../util/clamp';
import { toRouteFeatures } from '../util/route-features';
import { lineGradientExpression } from '../util/route-gradient';
import type { MapStyle } from './map';

const emptyFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const;

const ACTIVE_ROUTE_LAYERS = [
  'activeRouteLayer',
  'activeRouteLayer-case',
  'activeRouteIconsLayer',
  'activeRouteStartLayer',
  'activeRouteStepLayer',
  'activeRouteStepLayer-case',
] as const;

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

  constructor(private readonly mapStyle: MapStyle) {}

  renderActiveRoute(maybeRoute: Route | undefined): void {
    this.mapStyle.setSourceData('activeRouteStep', emptyFeatureCollection);
    this.lastRenderedActiveStepLine = undefined;

    if (!maybeRoute) {
      this.mapStyle.setSourceData('activeRoute', emptyFeatureCollection);
      return;
    }

    this.mapStyle.setSourceData('activeRoute', toRouteFeatures(maybeRoute));
    this.toggleActiveRouteLayers(true);
  }

  renderRoutePreview(
    maybeRoute: Route | undefined,
    options: { highlight: boolean; index: number; animate: boolean },
  ): void {
    const sourceId = `previewRoute-${options.index}`;
    if (!maybeRoute) {
      this.mapStyle.setSourceData(sourceId, emptyFeatureCollection);
      return;
    }

    this.mapStyle.setSourceData(sourceId, toRouteFeatures(maybeRoute));
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
        this.mapStyle.setLayerPaintProperty(
          `previewRouteLayer-${options.index}`,
          'line-gradient',
          lineGradientExpression({
            lineType: options.highlight
              ? 'animatedPrimaryLine'
              : 'animatedSecondaryLine',
            progress,
          }),
        );
        this.mapStyle.setLayerPaintProperty(
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
    if (
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

    if (this.lastRenderedActiveStepLine !== store.activeStepLine.line) {
      this.mapStyle.setSourceData('activeRouteStep', store.activeStepLine.line);
    }
    const stepProgress =
      distanceAlongActiveStepLine / store.activeStepLine.length;
    this.mapStyle.setLayerPaintProperty(
      'activeRouteStepLayer-case',
      'line-gradient',
      lineGradientExpression({ lineType: 'case', progress: stepProgress }),
    );
    this.mapStyle.setLayerPaintProperty(
      'activeRouteStepLayer',
      'line-gradient',
      lineGradientExpression({ lineType: 'line', progress: stepProgress }),
    );

    this.lastRenderedActiveStepLine = store.activeStepLine.line;

    const progress = clamp(
      distanceTraveled / store.geoJsonRoute.featureLength,
      0,
      1,
    );
    this.mapStyle.setLayerPaintProperty(
      'activeRouteLayer-case',
      'line-gradient',
      lineGradientExpression({ lineType: 'case', progress }),
    );
    this.mapStyle.setLayerPaintProperty(
      'activeRouteLayer',
      'line-gradient',
      lineGradientExpression({ lineType: 'line', progress }),
    );
  }

  drawStepArrow(step: RouteStep | undefined): void {
    if (!step?.arrowPoints || step.arrowPoints < 2) {
      this.mapStyle.setSourceData('previewStepArrow', emptyFeatureCollection);
      return;
    }

    const points = polyline.decode(step.geometry).slice(0, step.arrowPoints);
    const line = lineString(points);
    const bearingDegrees = bearing(points.at(-2)!, points.at(-1)!);
    const arrowHead = point(points.at(-1)!, { bearing: bearingDegrees });

    this.mapStyle.setSourceData(
      'previewStepArrow',
      featureCollection<GeoJSON.LineString | GeoJSON.Point>([line, arrowHead]),
    );
  }

  private toggleActiveRouteLayers(visible: boolean): void {
    for (const layerId of ACTIVE_ROUTE_LAYERS) {
      this.mapStyle.setLayerVisibility(layerId, visible);
    }
  }
}

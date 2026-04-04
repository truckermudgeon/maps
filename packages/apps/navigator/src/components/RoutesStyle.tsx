import { routingModes } from '@truckermudgeon/map/routing';
import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';
import { lineGradientExpression } from './SlippyMap';

export const RoutesStyle = () => {
  console.log('render routes layers');
  return (
    <>
      <Source
        id={'activeRoute'}
        type={'geojson'}
        lineMetrics={true}
        data={
          {
            type: 'FeatureCollection',
            features: [],
          } as GeoJSON.FeatureCollection
        }
      >
        <Layer
          id={'activeRouteLayer-case'}
          type={'line'}
          paint={{
            'line-gap-width': routeLineWidth,
            'line-width': caseWidth,
            'line-opacity': 1,
            'line-gradient': lineGradientExpression({
              lineType: 'case',
              progress: 0,
            }),
          }}
        />
        <Layer
          id={'activeRouteLayer'}
          type={'line'}
          paint={{
            'line-width': routeLineWidth,
            'line-opacity': 1,
            'line-gradient': lineGradientExpression({
              lineType: 'line',
              progress: 0,
            }),
          }}
        />
        <Layer
          id={'activeRouteIconsLayer'}
          type={'symbol'}
          layout={{
            'icon-image': '{sprite}',
            'icon-allow-overlap': true,
          }}
          minzoom={10}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'traffic'],
          ]}
        />
        <Layer
          id={'activeRouteStartLayer'}
          type={'circle'}
          paint={{
            'circle-radius': startPointWidth,
            'circle-color': '#fff',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#888',
          }}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'start'],
          ]}
        />
      </Source>
      {Array.from({ length: routingModes.size }, (_, i) => (
        <Source
          key={`previewRoute-${i}`}
          id={`previewRoute-${i}`}
          type={'geojson'}
          lineMetrics={true}
          data={
            {
              type: 'FeatureCollection',
              features: [],
            } as GeoJSON.FeatureCollection
          }
        >
          <Layer
            id={`previewRouteLayer-${i}-case`}
            type={'line'}
            paint={{
              'line-color': 'hsl(204,100%,40%)',
              'line-gap-width': routeLineWidth,
              'line-width': caseWidth,
              'line-opacity': 1,
            }}
          />
          <Layer
            id={`previewRouteLayer-${i}`}
            type={'line'}
            paint={{
              'line-color': 'hsl(204,100%,50%)',
              'line-width': routeLineWidth,
              'line-opacity': 1,
            }}
          />
        </Source>
      ))}
      <Source
        key={`previewStepArrow`}
        id={`previewStepArrow`}
        type={'geojson'}
        data={
          {
            type: 'FeatureCollection',
            features: [],
          } as GeoJSON.FeatureCollection
        }
      >
        <Layer
          id={`previewStepArrowCase`}
          type={'line'}
          layout={{
            'line-cap': 'round',
          }}
          paint={{
            'line-color': '#444',
            'line-gap-width': arrowLineWidth,
            'line-width': 2,
            'line-opacity': 1,
          }}
          filter={['in', '$type', 'LineString']}
        />
        <Layer
          id={`previewStepArrowArrow`}
          type={'symbol'}
          layout={{
            'icon-image': 'triangle',
            'icon-size': arrowSize,
            'icon-allow-overlap': true,
            'icon-pitch-alignment': 'map',
            'icon-rotation-alignment': 'map',
            'icon-rotate': ['get', 'bearing'],
          }}
          filter={['in', '$type', 'Point']}
        />
        <Layer
          id={`previewStepArrowLine`}
          type={'line'}
          layout={{
            'line-cap': 'round',
          }}
          paint={{
            'line-color': '#fff',
            'line-width': arrowLineWidth,
            'line-opacity': 1,
          }}
          filter={['in', '$type', 'LineString']}
        />
      </Source>
    </>
  );
};

const routeLineWidth: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  3,
  5,
  10,
  10,
];

const caseWidth: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  3,
  2,
  10,
  3,
];

const arrowLineWidth: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  3,
  5,
  10,
  11,
];

const arrowSize: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  3,
  0.33,
  10,
  1,
];

const startPointWidth: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  3,
  6,
  10,
  10,
];

import { assertExists } from '@truckermudgeon/base/assert';
import type { Extent } from '@truckermudgeon/base/geom';
import { center as calculateCenter } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';
import { routingModes } from '@truckermudgeon/map/routing';
import {
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
  SceneryTownSource,
} from '@truckermudgeon/ui';
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  Marker as MapLibreGLMarker,
} from 'maplibre-gl';
import type { ForwardRefExoticComponent, ReactElement } from 'react';
import { useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, { Layer, Source } from 'react-map-gl/maplibre';
import type { PlayerMarkerProps } from './PlayerMarker';
import './SlippyMap.css';

const tileRootUrl = import.meta.env.VITE_TILE_ROOT_URL;

// TODO read these values from the .pmtiles files at runtime.
const extents = {
  ats: [
    [-124.477162, 25.767968].map(n => Math.floor(n)),
    [-88.928336, 49.122384].map(n => Math.ceil(n)),
  ].flat() as Extent,
  ets2: [
    [-10.025698, 34.897275].map(n => Math.floor(n)),
    [33.284941, 71.573102].map(n => Math.ceil(n)),
  ].flat() as Extent,
};

const lineColors = {
  case: {
    before: 'hsl(204,0%,60%)',
    after: 'hsl(204,100%,40%)',
  },
  line: {
    before: 'hsl(204,0%,80%)',
    after: 'hsl(204,100%,50%)',
  },
  animatedPrimaryCase: {
    before: 'hsl(204,100%,40%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedPrimaryLine: {
    before: 'hsl(204,100%,50%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedSecondaryCase: {
    before: 'hsl(204,80%,70%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedSecondaryLine: {
    before: 'hsl(204,80%,80%)',
    after: 'rgba(0, 0, 0, 0)',
  },
};

export const lineGradientExpression = ({
  lineType,
  progress,
}: {
  lineType: keyof typeof lineColors;
  progress: number;
}) => {
  Preconditions.checkArgument(0 <= progress && progress <= 1);
  const { before, after } = lineColors[lineType];
  return [
    'step',
    ['line-progress'],
    before,
    progress,
    after,
  ] satisfies ExpressionSpecification;
};

export const SlippyMap = (props: {
  center?: [lon: number, lat: number];
  mode?: 'light' | 'dark';
  onLoad(map: MapRef, playerMarker: MapLibreGLMarker): void;
  onDragStart(): void;
  Destinations: () => ReactElement;
  TrailerOrWaypointMarkers: () => ReactElement;
  PlayerMarker: ForwardRefExoticComponent<PlayerMarkerProps>;
}) => {
  console.log('render slippy map');
  const {
    Destinations,
    TrailerOrWaypointMarkers,
    PlayerMarker,
    center = calculateCenter(extents.ats),
    mode = 'light',
  } = props;
  const mapRef = useRef<MapRef>(null);
  const playerMarkerRef = useRef<MapLibreGLMarker>(null);

  return (
    <MapGl
      ref={mapRef}
      initialViewState={{
        longitude: center[0],
        latitude: center[1],
      }}
      onLoad={() => {
        props.onLoad(
          assertExists(mapRef.current),
          assertExists(playerMarkerRef?.current),
        );
      }}
      onDragStart={() => props.onDragStart()}
      onZoomStart={e => {
        // we only care about zoom start events triggered by user input, not
        // triggered programmatically by, e.g., camera-moving APIs
        if (e.originalEvent) {
          props.onDragStart();
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
      }} // ensure map fills page
      minZoom={4}
      maxZoom={15}
      mapStyle={defaultMapStyle}
      attributionControl={false}
    >
      <BaseMapStyle tileRootUrl={tileRootUrl} mode={mode} />
      <GameMapStyle tileRootUrl={tileRootUrl} mode={mode} game={'ats'}>
        <>
          <SceneryTownSource mode={mode} game={'ats'} />
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
          </Source>
          <Source
            id={'activeRouteStart'}
            type={'geojson'}
            data={
              {
                type: 'FeatureCollection',
                features: [],
              } as GeoJSON.FeatureCollection
            }
          >
            <Layer
              id={'activeRouteStartLayer'}
              type={'circle'}
              paint={{
                'circle-radius': startPointWidth,
                'circle-color': '#fff',
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#888',
              }}
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
          <Source
            id={'activeRouteIcons'}
            type={'geojson'}
            data={
              {
                type: 'FeatureCollection',
                features: [],
              } as GeoJSON.FeatureCollection
            }
          >
            <Layer
              id={'activeRouteIconsLayer'}
              type={'symbol'}
              layout={{
                'icon-image': '{sprite}',
                'icon-allow-overlap': true,
              }}
              minzoom={10}
              filter={['in', '$type', 'Point']}
            />
          </Source>
        </>
      </GameMapStyle>
      <Destinations />
      <TrailerOrWaypointMarkers />
      <PlayerMarker mode={props.mode} ref={playerMarkerRef} />
      <div
        style={{
          fontSize: '0.9em',
          opacity: 0.25,
          background: 'transparent',
          position: 'absolute',
          right: '1em',
          bottom: 2,
        }}
      >
        <a
          style={{
            color: 'inherit',
            textDecoration: 'none',
            pointerEvents: 'none',
          }}
          href="https://github.com/truckermudgeon/maps"
        >
          TruckSim Maps
        </a>
      </div>
    </MapGl>
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

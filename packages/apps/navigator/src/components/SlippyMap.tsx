import { assertExists } from '@truckermudgeon/base/assert';
import type { Extent } from '@truckermudgeon/base/geom';
import { center as calculateCenter } from '@truckermudgeon/base/geom';
import { routingModes } from '@truckermudgeon/map/routing';
import {
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
  SceneryTownSource,
} from '@truckermudgeon/ui';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
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
        height: '100vh',
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
                'line-color': 'hsl(204,100%,40%)',
                'line-gap-width': 8,
                'line-width': 4,
                'line-opacity': 1,
              }}
            />
            <Layer
              id={'activeRouteLayer'}
              type={'line'}
              paint={{
                'line-color': 'hsl(204,100%,50%)',
                'line-width': 10,
                'line-opacity': 1,
              }}
            />
          </Source>
          {Array.from({ length: routingModes.size }, (_, i) => (
            <Source
              key={`previewRoute-${i}`}
              id={`previewRoute-${i}`}
              type={'geojson'}
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
                  'line-gap-width': 8,
                  'line-width': 4,
                  'line-opacity': 1,
                }}
              />
              <Layer
                id={`previewRouteLayer-${i}`}
                type={'line'}
                paint={{
                  'line-color': 'hsl(204,100%,50%)',
                  'line-width': 10,
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
                'line-gap-width': 11,
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
                'line-width': 11,
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
          style={{ color: 'inherit', textDecoration: 'none' }}
          href="https://github.com/truckermudgeon/maps"
        >
          TruckSim Maps
        </a>
      </div>
    </MapGl>
  );
};

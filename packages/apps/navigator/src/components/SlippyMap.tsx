import { assertExists } from '@truckermudgeon/base/assert';
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
    center = [0, 0],
    mode = 'light',
  } = props;
  // HACK hardcode tileRootUrl so that it uses the `navigator`'s webserver root,
  // because it's still under development and no public-facing hosted version
  // exists yet.
  const tileRootUrl = '';
  const mapRef = useRef<MapRef>(null);
  const playerMarkerRef = useRef<MapLibreGLMarker>(null);
  return (
    <MapGl
      ref={mapRef}
      initialViewState={{
        longitude: center[0],
        latitude: center[1],
      }}
      onLoad={() =>
        props.onLoad(
          assertExists(mapRef.current),
          assertExists(playerMarkerRef.current),
        )
      }
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
      <GameMapStyle tileRootUrl={tileRootUrl} mode={mode} game={'ats'} />
      <GameMapStyle tileRootUrl={tileRootUrl} mode={mode} game={'ets2'} />
      <SceneryTownSource mode={mode} game={'ats'} />
      <SceneryTownSource mode={mode} game={'ets2'} />
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
      {Array.from({ length: 2 }, (_, i) => (
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
            id={`previewRouteLayer-${i}`}
            type={'line'}
            paint={{
              'line-color': '#f00',
              'line-width': 10,
              'line-opacity': 1,
            }}
          />
        </Source>
      ))}
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

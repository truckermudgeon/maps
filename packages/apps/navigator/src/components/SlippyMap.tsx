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
import MapGl, {
  AttributionControl,
  Layer,
  Source,
} from 'react-map-gl/maplibre';
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
    >
      <BaseMapStyle mode={mode} />
      <GameMapStyle mode={mode} game={'ats'} />
      <GameMapStyle mode={mode} game={'ets2'} />
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
          id={'activeRouteLayer'}
          type={'line'}
          paint={{
            'line-color': '#f00',
            'line-width': 5,
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
              'line-width': 5,
              'line-opacity': 1,
            }}
          />
        </Source>
      ))}
      <Destinations />
      <TrailerOrWaypointMarkers />
      <PlayerMarker mode={props.mode} ref={playerMarkerRef} />
      <AttributionControl
        compact={true}
        style={{
          marginLeft: 54,
          opacity: 0.5,
        }}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a> and <a href='https://forum.scssoft.com/viewtopic.php?p=1946956#p1946956'>krmarci</a>."
      />
    </MapGl>
  );
};

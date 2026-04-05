import { assertExists } from '@truckermudgeon/base/assert';
import type { Extent } from '@truckermudgeon/base/geom';
import { center as calculateCenter } from '@truckermudgeon/base/geom';
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
import MapGl from 'react-map-gl/maplibre';
import type { PlayerMarkerProps } from './PlayerMarker';
import { RoutesStyle } from './RoutesStyle';
import './SlippyMap.css';

const tileRootUrl = import.meta.env.VITE_TILE_ROOT_URL;

// TODO read these values from the .pmtiles files at runtime.
const extents = {
  usa: [
    [-124.477162, 25.767968].map(n => Math.floor(n)),
    [-88.928336, 49.122384].map(n => Math.ceil(n)),
  ].flat() as Extent,
  europe: [
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
  map: 'usa' | 'europe';
}) => {
  console.log('render slippy map');
  const {
    Destinations,
    TrailerOrWaypointMarkers,
    PlayerMarker,
    center = calculateCenter(extents[props.map]),
    mode = 'light',
    map,
  } = props;
  const game = map === 'usa' ? 'ats' : 'ets2';
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
      <GameMapStyle tileRootUrl={tileRootUrl} mode={mode} game={game}>
        <RoutesStyle />
        <SceneryTownSource mode={mode} game={game} />
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

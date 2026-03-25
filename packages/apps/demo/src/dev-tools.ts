import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
} from '@truckermudgeon/map/projections';
import type { MapRef } from 'react-map-gl/maplibre';

declare global {
  interface Window {
    __DEV__?: DevTools;
  }
}

interface DevTools {
  readonly map: MapRef;
  readonly fromGameCoordsToWgs84: (
    game: 'ats' | 'ets2',
    x: number,
    y: number,
  ) => { x: number; y: number; lng: number; lat: number };
  readonly fromWgs84ToGameCoords: (
    game: 'ats' | 'ets2',
    lng: number,
    lat: number,
  ) => { x: number; y: number; lng: number; lat: number };
}

export function setupDevtools({ map }: { map: MapRef }) {
  if (!import.meta.env.DEV) {
    return;
  }

  const fromGameCoordsToWgs84 = (
    game: 'ats' | 'ets2',
    x: number,
    y: number,
  ) => {
    let lngLat: [number, number];
    switch (game) {
      case 'ats':
        lngLat = fromAtsCoordsToWgs84([x, y]);
        break;
      case 'ets2':
        lngLat = fromEts2CoordsToWgs84([x, y]);
        break;
      default:
        throw new UnreachableError(game);
    }
    return { x, y, lng: lngLat[0], lat: lngLat[1] };
  };

  const fromWgs84ToGameCoords = (
    game: 'ats' | 'ets2',
    lng: number,
    lat: number,
  ) => {
    let gameCoords: [number, number];
    switch (game) {
      case 'ats':
        gameCoords = fromWgs84ToAtsCoords([lng, lat]);
        break;
      case 'ets2':
        gameCoords = fromWgs84ToEts2Coords([lng, lat]);
        break;
      default:
        throw new UnreachableError(game);
    }
    return { x: gameCoords[0], y: gameCoords[1], lng, lat };
  };

  window.__DEV__ = {
    map,
    fromGameCoordsToWgs84,
    fromWgs84ToGameCoords,
  };

  console.info('dev tools available at window.__DEV__');
}

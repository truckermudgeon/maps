import { toDegrees, toRadians } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { MapRef } from 'react-map-gl/maplibre';
import type { ViewerAPI } from 'react-photo-sphere-viewer';

export const calculateMapHash = (map: MapRef) => {
  const center = map.getCenter();
  const bearing = map.getBearing();
  const pitch = map.getPitch();
  const bnp = bearing || pitch ? [bearing, pitch] : [];
  const zoom = map.getZoom();
  return (
    '#' +
    [zoom, center.lat, center.lng, ...bnp]
      .map(n => Number(n.toFixed(3)))
      .join('/')
  );
};

const minMaxFov = [15, 90] as const;
const fovRange = minMaxFov[1] - minMaxFov[0];

export const toMapCamera = (hash: string) => {
  const [zoom, lat, lng, b = '0', p = '0'] = hash.slice(1).split('/');
  // TODO validation. force invalid values to be valid?
  return {
    zoom: Number(zoom),
    lngLat: [Number(lng), Number(lat)] as [number, number],
    bearing: Number(b),
    pitch: Number(p),
  };
};

export const syncMapCameraToHash = (map: MapRef, hash: string) => {
  const [mapHash] = hash.split('!');
  if (!mapHash) {
    return;
  }
  if (mapHash === calculateMapHash(map)) {
    return;
  }

  const targetCamera = toMapCamera(mapHash);
  map.setZoom(targetCamera.zoom);
  map.setCenter(targetCamera.lngLat);
  map.setBearing(targetCamera.bearing);
  map.setPitch(targetCamera.pitch);
};

export const calculatePanoHash = (
  viewer: ViewerAPI,
  panoId: string,
): string => {
  const { yaw, pitch } = viewer.getPosition();
  const zoom = viewer.getZoomLevel();
  const yawDeg = Number(toDegrees(yaw).toFixed(2));
  const pitchDeg = Number(toDegrees(pitch).toFixed(2));
  const zoomFov = Number(
    ((1 - zoom / 100) * fovRange + minMaxFov[0]).toFixed(2),
  );
  return '!' + [panoId, yawDeg, pitchDeg, zoomFov].join('/');
};

export const toPanoCamera = (panoHash: string) => {
  Preconditions.checkArgument(panoHash.startsWith('!'));
  const [id, yaw, pitch, zoom] = panoHash.slice(1).split('/');
  // TODO validation. force invalid values to be valid?

  // fov = (1 - zoom / 100) * fovRange + minMaxFov[0]
  // fov - minFov = (1 - zoom / 100) * fovRange
  // (fov - minFov) / fovRange = 1 - zoom / 100
  // zoom / 100  = 1 - (fov - minFov) / fovRange
  // zoom = (1 - (fov - minFov) / fovRange) * 100

  return {
    id,
    yaw: Number(toRadians(Number(yaw ?? 0)).toFixed(3)),
    pitch: Number(toRadians(Number(pitch ?? 0)).toFixed(3)),
    zoom: Math.round((1 - (Number(zoom ?? 0) - minMaxFov[0]) / fovRange) * 100),
  };
};

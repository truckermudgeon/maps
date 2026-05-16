import type { Extent } from '@truckermudgeon/base/geom';
import { grow } from '@truckermudgeon/base/geom';
import maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

let pmTilesProtocolAdded = false;

export function addPmTilesProtocol() {
  if (pmTilesProtocolAdded) {
    return;
  }

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmTilesProtocolAdded = true;
}

const boundsCache = new Map<string, Promise<Extent>>();

export function getPmTilesBounds(url: string): Promise<Extent> {
  if (boundsCache.has(url)) {
    return boundsCache.get(url)!;
  }

  const extentPromise = new pmtiles.PMTiles(url)
    .getHeader()
    .then(
      ({ minLon, minLat, maxLon, maxLat }): Extent =>
        grow([minLon, minLat, maxLon, maxLat], 0.5),
    );
  boundsCache.set(url, extentPromise);
  return extentPromise;
}

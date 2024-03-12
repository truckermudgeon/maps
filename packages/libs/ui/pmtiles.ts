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

import type { Position } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type { GeoJSON } from 'geojson';

/**
 * Mutates coordinates in `feature` by normalizing them with `normalizer`.
 */
export function createNormalizeFeature(
  map: 'usa' | 'europe',
  decimalPoints?: number,
) {
  const normalize = createNormalizeCoordinates(map, decimalPoints);
  return <
    T extends GeoJSON.Feature<
      | GeoJSON.Point
      | GeoJSON.LineString
      | GeoJSON.MultiLineString
      | GeoJSON.Polygon
      | GeoJSON.MultiPolygon
    >,
  >(
    feature: T,
  ): T => {
    switch (feature.geometry.type) {
      case 'LineString':
        feature.geometry.coordinates =
          feature.geometry.coordinates.map(normalize);
        break;
      case 'MultiLineString':
        feature.geometry.coordinates = feature.geometry.coordinates.map(l =>
          l.map(normalize),
        );
        break;
      case 'Polygon':
        feature.geometry.coordinates = feature.geometry.coordinates.map(p =>
          p.map(normalize),
        );
        break;
      case 'MultiPolygon':
        feature.geometry.coordinates = feature.geometry.coordinates.map(p =>
          p.map(pp => pp.map(ppp => normalize(ppp))),
        );
        break;
      case 'Point':
        feature.geometry.coordinates = normalize(feature.geometry.coordinates);
        break;
      default:
        throw new UnreachableError(feature.geometry);
    }

    return feature;
  };
}

function createNormalizeCoordinates(
  map: 'usa' | 'europe',
  decimalPoints?: number,
) {
  const tx = map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
  return (p: number[]): Position => {
    Preconditions.checkArgument(
      p.length === 2,
      `expected 2 coords, received ${p.length}`,
    );
    const pp = tx(p as Position);
    if (decimalPoints == null) {
      return pp;
    }

    const factor = Math.pow(10, decimalPoints);
    return pp.map(v => Math.round(v * factor) / factor) as Position;
  };
}

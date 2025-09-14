import { putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions } from '@truckermudgeon/base/precon';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Maps ETS2 {@link Country} `code` values to ISO 3166-1 alpha-2 codes.
 * If an entry isn't listed here, then `Country::code` is assumed to
 * be an ISO 3166-1 alpha-2 code.
 *
 * @see {@link https://en.wikipedia.org/wiki/International_vehicle_registration_code}
 */
export const ets2IsoA2 = new Map([
  ['A', 'AT'],
  ['B', 'BE'],
  ['BIH', 'BA'],
  ['EST', 'EE'],
  ['F', 'FR'],
  ['D', 'DE'],
  ['H', 'HU'],
  ['I', 'IT'],
  ['RKS', 'XK'], // Kosovo
  ['L', 'LU'],
  ['NMK', 'MK'],
  ['MNE', 'ME'],
  ['N', 'NO'],
  ['P', 'PT'],
  ['SRB', 'RS'],
  ['SLO', 'SI'],
  ['E', 'ES'],
  ['S', 'SE'],
]);

/**
 * Reverse map of {@link ets2IsoA2}. Maps ISO 3166-1 alpha-2 codes to ETS2
 * `code` values. If an entry isn't listed here, then the country's ISO code is
 * assumed to be equal to the corresponding ETS2 `Country::code`.
 */
export const isoA2Ets2 = new Map(ets2IsoA2.entries().map(([k, v]) => [v, k]));

export interface PopulatedPlacesProperties {
  name: string;
  namealt: string;
  adm1name: string;
  sov0name: string;
  iso_a2: string;
  scalerank: number;
  featurecla: string;
}

export function getCitiesByCountryIsoA2(): Map<
  string,
  PopulatedPlacesProperties[]
> {
  const populatedPlaces = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../resources',
        // from https://github.com/nvkelso/natural-earth-vector
        'ne_10m_populated_places_simple.geojson',
      ),
      'utf-8',
    ),
  ) as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Point,
    PopulatedPlacesProperties
  >;
  const citiesByCountryIsoA2 = new Map<string, PopulatedPlacesProperties[]>();
  for (const { properties: city } of populatedPlaces.features) {
    const isoA2 = city.sov0name === 'Kosovo' ? 'XK' : city.iso_a2;
    const cities = putIfAbsent(isoA2, [], citiesByCountryIsoA2);
    if (!/^[A-Z][A-Z]$/.test(isoA2)) {
      // logger.warn(city.sov0name, 'has invalid iso a2 code');
    }
    cities.push(city);
  }
  return citiesByCountryIsoA2;
}

export function createIsoA2Map(): {
  get: (gameCountryCode: string) => string;
} {
  const isoA2s = new Set(getCitiesByCountryIsoA2().keys());
  return {
    get: (gameCountryCode: string) => {
      if (isoA2s.has(gameCountryCode)) {
        return gameCountryCode;
      }
      Preconditions.checkArgument(ets2IsoA2.has(gameCountryCode));
      return ets2IsoA2.get(gameCountryCode)!;
    },
  };
}

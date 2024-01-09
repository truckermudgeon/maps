import type { Position } from '@truckermudgeon/base/geom';
import * as proj4 from 'proj4';

// Projection based on def/climate.sii:
// "mapProjection": "lambert_conic",
// "standardParalel1": 33,
// "standardParalel2": 45,
// "mapOrigin": [39, -96],
// Note: k is 0.05088 and not 0.05 because it looks like ATS scale isn't exactly 1:20.
const ats =
  '+proj=lcc +lat_1=33 +lat_2=45 +lat_0=39 +lon_0=-96 +units=m +k_0=0.05088 +ellps=sphere';
const fromWgs84ToAtsConverter = proj4.default(ats);
export const fromAtsCoordsToWgs84 = ([x, y]: Position): Position => {
  // ATS coords are like LCC coords, except in ATS coords Y grows southward (its sign is reversed).
  const lccCoords: Position = [x, -y];
  return fromWgs84ToAtsConverter.inverse(lccCoords);
};

// Projection and offsets based on def/climate.sii:
// "mapProjection": "lambert_conic",
// "standardParalel1": 37,
// "standardParalel2": 65,
// "mapOrigin": [50, 15],
// "mapOffset": [
//   16660,
//   4150
// ],
const ets2Scale = 1 / 19.35; // maybe this is better off as ~19.1?
const ukScale = ets2Scale / 0.75;
const ets2 = `+proj=lcc +lat_1=37 +lat_2=65 +lat_0=50 +lon_0=15 +units=m +k_0=${ets2Scale} +ellps=sphere`;
const uk = `+proj=lcc +lat_1=37 +lat_2=65 +lat_0=50 +lon_0=15 +units=m +k_0=${ukScale} +ellps=sphere`;
const fromWgs84ToEts2Converter = proj4.default(ets2);
const fromWgs84ToUkConverter = proj4.default(uk);
export const fromEts2CoordsToWgs84 = ([x, y]: Position): Position => {
  // N.B.: all the UK detection and offsetting are just guesses.
  // Couldn't find anything in def files to do this in a more accurate way.

  // treat all coords up-and-to-the-left of Calais as UK coords
  const calais = [-31140, -5505];
  const isUk = x < calais[0] && y < calais[1] - 100;
  const converter = isUk ? fromWgs84ToUkConverter : fromWgs84ToEts2Converter;
  // ETS2 defines a map_offset tuple, which should be applied to coords before projecting.
  x -= 16_660;
  y -= 4_150;
  // UK coords need even more offsetting
  if (isUk) {
    x -= 16_650; // bigger offset => push UK stuff left
    y -= 2_700; // smaller offset => push UK stuff down
  }
  // ETS2 coords are like LCC coords, except in ETS2 coords Y grows southward (its sign is reversed).
  const lccCoords: Position = [x, -y];
  return converter.inverse(lccCoords);
};

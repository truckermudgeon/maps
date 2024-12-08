import type { Position } from '@truckermudgeon/base/geom';
import { toRadians } from '@truckermudgeon/base/geom';
import * as proj4 from 'proj4';

// from def/climate.sii
const atsDefData = {
  mapProjection: 'lambert_conic',
  standardParalel1: 33,
  standardParalel2: 45,
  mapOrigin: [39, -96],
  mapFactor: [-0.00017706234, 0.000176689948],
} as const;
const atsScale = Math.abs(
  lengthOfDegreeAt(atsDefData.mapOrigin[0]) * atsDefData.mapFactor[0],
); // 19.65665620539649
const ats = [
  '+proj=lcc', // lambert conformal conic
  '+units=m',
  '+ellps=sphere',
  `+lat_1=${atsDefData.standardParalel1}`,
  `+lat_2=${atsDefData.standardParalel2}`,
  `+lat_0=${atsDefData.mapOrigin[0]}`,
  `+lon_0=${atsDefData.mapOrigin[1]}`,
  `+k_0=${1 / atsScale}`,
].join(' ');

const fromWgs84ToAtsConverter = proj4.default(ats);
export const fromAtsCoordsToWgs84 = ([x, y]: Position): Position => {
  // ATS coords are like LCC coords, except in ATS coords Y grows southward (its sign is reversed).
  const lccCoords: Position = [x, -y];
  return fromWgs84ToAtsConverter.inverse(lccCoords);
};

// from def/climate.sii
const ets2DefData = {
  mapProjection: 'lambert_conic',
  standardParalel1: 37,
  standardParalel2: 65,
  mapOrigin: [50, 15],
  mapOffset: [16660, 4150],
  mapFactor: [-0.000171570875, 0.0001729241463],
} as const;
const ets2Scale = Math.abs(
  lengthOfDegreeAt(ets2DefData.mapOrigin[0]) * ets2DefData.mapFactor[0],
); // 19.083661390678152
const baseEts2 = [
  '+proj=lcc', // lambert conformal conic
  '+units=m',
  '+ellps=sphere',
  `+lat_1=${ets2DefData.standardParalel1}`,
  `+lat_2=${ets2DefData.standardParalel2}`,
  `+lat_0=${ets2DefData.mapOrigin[0]}`,
  `+lon_0=${ets2DefData.mapOrigin[1]}`,
];
const ets2 = [...baseEts2, `+k_0=${1 / ets2Scale}`].join(' ');
const uk = [...baseEts2, `+k_0=${1 / (ets2Scale * 0.75)}`].join(' ');
const fromWgs84ToEts2Converter = proj4.default(ets2);
const fromWgs84ToUkConverter = proj4.default(uk);
export const fromEts2CoordsToWgs84 = ([x, y]: Position): Position => {
  // N.B.: all the UK detection and offsetting are just guesses.
  // Couldn't find anything in def files to do this in a more accurate way.

  // treat all coords up-and-to-the-left of Calais as UK coords
  const calais = [-31100, -5500];
  const isUk = x < calais[0] && y < calais[1];
  const converter = isUk ? fromWgs84ToUkConverter : fromWgs84ToEts2Converter;
  // apply mapOffset to coords before projecting.
  x -= ets2DefData.mapOffset[0];
  y -= ets2DefData.mapOffset[1];
  // UK coords need even more offsetting
  if (isUk) {
    x -= 16_650; // bigger offset => push UK stuff left
    y -= 2_700; // smaller offset => push UK stuff down
  }
  // ETS2 coords are like LCC coords, except in ETS2 coords Y grows southward (its sign is reversed).
  const lccCoords: Position = [x, -y];
  return converter.inverse(lccCoords);
};

// from https://gis.stackexchange.com/questions/75528/understanding-terms-in-length-of-degree-formula/
function lengthOfDegreeAt(latInDegrees: number): number {
  const m1 = 111132.92;
  const m2 = -559.82;
  const m3 = 1.175;
  const m4 = -0.0023;

  // Calculate the length of a degree of latitude in meters
  const lat = toRadians(latInDegrees);
  return (
    m1 +
    m2 * Math.cos(2 * lat) +
    m3 * Math.cos(4 * lat) +
    m4 * Math.cos(6 * lat)
  );
}

import type { Position } from '@truckermudgeon/base/geom';
import * as proj4 from 'proj4';

// The Earth radius is canceled out in the coordinate calculation, so the exact
// value doesn't matter. The chosen radius is the Clarke 1866 Authalic Sphere.
const earthRadiusMeters = 6_370_997;
export const lengthOfDegree = (earthRadiusMeters * Math.PI) / 180;

// from def/climate.sii
const atsDefData = {
  mapProjection: 'lambert_conic',
  standardParalel1: 33,
  standardParalel2: 45,
  mapOrigin: [39, -96],
  mapFactor: [-0.00017706234, 0.000176689948],
} as const;
const ats = [
  '+proj=lcc', // lambert conformal conic
  `+R=${earthRadiusMeters}`,
  `+lat_1=${atsDefData.standardParalel1}`,
  `+lat_2=${atsDefData.standardParalel2}`,
  `+lat_0=${atsDefData.mapOrigin[0]}`,
  `+lon_0=${atsDefData.mapOrigin[1]}`,
].join(' ');

const fromWgs84ToAtsConverter = proj4.default(ats);
export const fromAtsCoordsToWgs84 = ([x, y]: Position): Position => {
  const lccCoords: Position = [
    x * atsDefData.mapFactor[1] * lengthOfDegree, // ~19.647 ┬ avg ~19.668
    y * atsDefData.mapFactor[0] * lengthOfDegree, // ~19.688 ┘
  ];
  return fromWgs84ToAtsConverter.inverse(lccCoords);
};

export const fromWgs84ToAtsCoords = ([lon, lat]: Position): Position => {
  const unscaled = fromWgs84ToAtsConverter.forward([lon, lat]);
  return [
    unscaled[0] / atsDefData.mapFactor[1] / lengthOfDegree,
    unscaled[1] / atsDefData.mapFactor[0] / lengthOfDegree,
  ].map(v => Number(v.toFixed(10))) as [number, number];
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
const ets2 = [
  '+proj=lcc', // lambert conformal conic
  `+R=${earthRadiusMeters}`,
  `+lat_1=${ets2DefData.standardParalel1}`,
  `+lat_2=${ets2DefData.standardParalel2}`,
  `+lat_0=${ets2DefData.mapOrigin[0]}`,
  `+lon_0=${ets2DefData.mapOrigin[1]}`,
].join(' ');
const fromWgs84ToEts2Converter = proj4.default(ets2);
export const fromEts2CoordsToWgs84 = ([x, y]: Position): Position => {
  const sx = Math.floor(x / 4000);
  const sy = Math.floor(y / 4000);
  // apply mapOffset to coords before projecting.
  x -= ets2DefData.mapOffset[0];
  y -= ets2DefData.mapOffset[1];

  // UK content is authored at a slightly larger scale (~14.37 vs. ~19.15)
  const ukScaleFactor = 0.75;
  // HACK: treat all coords up-and-to-the-left of the sector containing Calais
  // (-31_100, -5500) as UK coords. Maybe there's a better way to do this, but I
  // couldn't find any clues in the def files.
  const calais = [-31100, -5500];
  const isUk = sx <= -8 && sy <= -2;

  if (isUk) {
    x = (x + calais[0] / 2) * ukScaleFactor;
    y = (y + calais[1] / 2) * ukScaleFactor;
  }

  const lccCoords: Position = [
    x * ets2DefData.mapFactor[1] * lengthOfDegree, // ~19.228 ┬ avg ~19.153
    y * ets2DefData.mapFactor[0] * lengthOfDegree, // ~19.078 ┘
  ];
  return fromWgs84ToEts2Converter.inverse(lccCoords);
};

export const fromWgs84ToEts2Coords = ([lon, lat]: Position): Position => {
  const unscaled = fromWgs84ToEts2Converter.forward([lon, lat]);
  let [x, y] = [
    unscaled[0] / ets2DefData.mapFactor[1] / lengthOfDegree,
    unscaled[1] / ets2DefData.mapFactor[0] / lengthOfDegree,
  ] as [number, number];

  // UK content is authored at a slightly larger scale (~14.37 vs. ~19.15)
  const ukScaleFactor = 0.75;
  // HACK: treat all coords up-and-to-the-left of the sector containing Calais
  // (-31_100, -5500) as UK coords. Maybe there's a better way to do this, but I
  // couldn't find any clues in the def files.
  const calais = [-31100, -5500];
  const xIfUk = x / ukScaleFactor - calais[0] / 2 + ets2DefData.mapOffset[0];
  const yIfUk = y / ukScaleFactor - calais[1] / 2 + ets2DefData.mapOffset[1];
  const sx = Math.floor(xIfUk / 4000);
  const sy = Math.floor(yIfUk / 4000);
  const isUk = sx <= -8 && sy <= -2;

  if (isUk) {
    x = x / ukScaleFactor - calais[0] / 2;
    y = y / ukScaleFactor - calais[1] / 2;
  }

  return [
    x + ets2DefData.mapOffset[0], //
    y + ets2DefData.mapOffset[1],
  ].map(v => Number(v.toFixed(10))) as [number, number];
};

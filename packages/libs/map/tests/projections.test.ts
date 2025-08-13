import type { Position } from '@truckermudgeon/base/geom';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
} from '../projections';

describe('ATS', () => {
  // somewhere near Las Vegas, NV
  const lvGame: Position = [-85_672, 7870];
  const lvLonLat: Position = [-114.92606131601985, 36.00959614633237];

  it('converts game coords to longitude/latitude and back', () => {
    expect(fromAtsCoordsToWgs84(lvGame)).toEqual(lvLonLat);
    expect(fromWgs84ToAtsCoords(lvLonLat)).toEqual(lvGame);
  });
});

describe('ETS', () => {
  // somewhere south of London, England
  const londonGame: Position = [-40_169, -10_685];
  const londonLonLat: Position = [-0.5943602137854889, 51.29443960532431];

  // somewhere between Chania and Heraklion, Greece
  const greeceGame: Position = [62_276, 84_880];
  const greeceLonLat: Position = [24.63877984644102, 35.391305791648065];

  it('converts UK game coords to longitude/latitude and back', () => {
    expect(fromEts2CoordsToWgs84(londonGame)).toEqual(londonLonLat);
    expect(fromWgs84ToEts2Coords(londonLonLat)).toEqual(londonGame);
  });

  it('converts longitude/latitude to non-UK game coords', () => {
    expect(fromEts2CoordsToWgs84(greeceGame)).toEqual(greeceLonLat);
    expect(fromWgs84ToEts2Coords(greeceLonLat)).toEqual(greeceGame);
  });
});

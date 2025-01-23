import { fromAtsCoordsToWgs84, fromEts2CoordsToWgs84 } from '../projections';

describe('fromAtsCoordsToWgs84', () => {
  it('converts game coords to longitude/latitude', () => {
    // somewhere near Las Vegas, NV
    const lonLat = fromAtsCoordsToWgs84([-85_672, 7870]);
    expect(lonLat).toEqual([-114.92606131601985, 36.00959614633237]);
  });
});

describe('fromEts2CoordsToWgs84', () => {
  it('converts UK game coords to longitude/latitude', () => {
    // somewhere south of London, England
    const lonLat = fromEts2CoordsToWgs84([-40_169, -10_685]);
    expect(lonLat).toEqual([-0.5943602137854889, 51.29443960532431]);
  });

  it('converts non-UK game coords to longitude/latitude', () => {
    // somewhere between Chania and Heraklion, Greece
    const lonLat = fromEts2CoordsToWgs84([62_276, 84_880]);
    expect(lonLat).toEqual([24.63877984644102, 35.391305791648065]);
  });
});

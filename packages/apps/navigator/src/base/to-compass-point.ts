import { assert } from '@truckermudgeon/base/assert';

export function toCompassPoint(bearing: number) {
  const azimuth = bearing >= 0 ? bearing : 360 + bearing;
  if (337.5 <= azimuth || azimuth < 22.5) {
    return 'N';
  } else if (22.5 <= azimuth && azimuth < 67.5) {
    return 'NE';
  } else if (67.5 <= azimuth && azimuth < 112.5) {
    return 'E';
  } else if (112.5 <= azimuth && azimuth < 157.5) {
    return 'SE';
  } else if (157.5 <= azimuth && azimuth < 202.5) {
    return 'S';
  } else if (202.5 <= azimuth && azimuth < 247.5) {
    return 'SW';
  } else if (247.5 <= azimuth && azimuth < 292.5) {
    return 'W';
  } else {
    assert(292.5 <= azimuth && azimuth < 337.5);
    return 'NW';
  }
}

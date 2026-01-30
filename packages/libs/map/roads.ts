import type { LaneSpeedClass, RoadLook, RoadType } from './types';

export function getRoadType(look: RoadLook): RoadType {
  const lanes = look.lanesLeft.concat(look.lanesRight);
  if (lanes.length === 0) {
    // logger.warn(
    //   "trying to get road types without lane info. defaulting to 'local'"
    // );
    return 'local';
  }

  let roadType: RoadType = 'unknown';
  // prioritize types. assumes road looks can contain multiple types.
  if (lanes.some(l => l.includes('freeway') || l.includes('motorway'))) {
    roadType = 'freeway';
  } else if (
    lanes.some(l => l.includes('divided') || l.includes('expressway'))
  ) {
    roadType = 'divided';
  } else if (
    lanes.some(l =>
      ['local', 'no_vehicles', 'side_road', 'slow_road'].some(t =>
        l.includes(t),
      ),
    )
  ) {
    roadType = 'local';
  } else if (lanes.some(l => l.includes('tram'))) {
    roadType = 'tram';
  } else if (lanes.some(l => l.includes('train'))) {
    roadType = 'train';
  }
  return roadType;
}

export function getLaneSpeedClass(look: RoadLook): LaneSpeedClass {
  const lanes = look.lanesLeft.concat(look.lanesRight);
  if (lanes.some(l => l.includes('freeway'))) {
    return 'freeway';
  } else if (lanes.some(l => l.includes('motorway'))) {
    return 'motorway';
  } else if (lanes.some(l => l.includes('expressway'))) {
    return 'expressway';
  } else if (lanes.some(l => l.includes('divided'))) {
    return 'dividedRoad';
  } else if (lanes.some(l => l.includes('slow_road'))) {
    return 'slowRoad';
  }
  return 'localRoad';
}

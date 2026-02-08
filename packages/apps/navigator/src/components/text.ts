import { assert, assertExists } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { BranchType } from '@truckermudgeon/navigation/constants';
import type {
  SearchResult,
  StepManeuver,
} from '@truckermudgeon/navigation/types';

export function toLengthAndUnit(
  meters: number,
  options: {
    abbreviateUnits: boolean;
    units: 'metric' | 'imperial';
    forceSingular: boolean;
  } = {
    abbreviateUnits: true,
    units: 'imperial',
    forceSingular: false,
  },
): {
  length: number;
  unit: string;
  string: string;
} {
  const { abbreviateUnits, units, forceSingular } = options;
  if (units === 'metric') {
    throw new Error('metric units currently unsupported');
  }

  const miles = meters * 0.0006213712;
  let raw;
  if (miles <= 0.1) {
    const feet = Math.max(1, meters * 3.28084);
    const length = Math.round(feet / 50) * 50;
    const singular = forceSingular || length === 1;
    raw = {
      length,
      unit: abbreviateUnits ? 'ft' : singular ? 'foot' : 'feet',
    };
  } else if (miles <= 1) {
    const length = Number(miles.toPrecision(1));
    const singular = forceSingular || length === 1;
    raw = {
      length,
      unit: abbreviateUnits ? 'mi' : singular ? 'mile' : 'miles',
    };
  } else if (miles <= 10) {
    raw = {
      length: Number(miles.toPrecision(2)),
      unit: abbreviateUnits ? 'mi' : forceSingular ? 'mile' : 'miles',
    };
  } else {
    raw = {
      length: Math.round(miles),
      unit: abbreviateUnits ? 'mi' : forceSingular ? 'mile' : 'miles',
    };
  }
  return {
    ...raw,
    string: `${raw.length.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${raw.unit}`,
  };
}

export function toDuration(
  seconds: number,
  options: { abbreviateUnits: boolean; forceSingular: boolean } = {
    abbreviateUnits: true,
    forceSingular: false,
  },
): {
  hours: number;
  minutes: number;
  string: string;
} {
  const { forceSingular } = options;
  const hourUnit = options.abbreviateUnits
    ? { plural: 'hr', singular: 'hr' }
    : { plural: 'hours', singular: 'hour' };
  const minuteUnit = options.abbreviateUnits
    ? { plural: 'min', singular: 'min' }
    : { plural: 'minutes', singular: 'minute' };
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);

  const strings: string[] = [];
  if (hours) {
    strings.push(
      hours === 1
        ? `1 ${hourUnit.singular}`
        : `${hours} ${forceSingular ? hourUnit.singular : hourUnit.plural}`,
    );
  }
  strings.push(
    mins === 1
      ? `1 ${minuteUnit.singular}`
      : `${mins} ${forceSingular ? minuteUnit.singular : minuteUnit.plural}`,
  );
  const string = options.abbreviateUnits
    ? strings.join(' ')
    : strings.join(', ');

  return {
    hours,
    minutes: mins,
    string,
  };
}

export function toStepText(maneuver: StepManeuver): string {
  const strings: string[] = [];

  if (maneuver.laneHint?.lanes.length) {
    const lanes = maneuver.laneHint.lanes;
    const isAllActive = lanes.every(l => l.activeBranch != null);
    let numLeftLanes = 0;
    for (const lane of lanes) {
      if (lane.activeBranch != null) {
        numLeftLanes++;
        continue;
      }
      break;
    }
    let numRightLanes = 0;
    for (const lane of lanes.toReversed()) {
      if (lane.activeBranch != null) {
        numRightLanes++;
        continue;
      }
      break;
    }

    if (isAllActive) {
      strings.push('use any lane to');
    } else if (numLeftLanes > 1) {
      if (maneuver.direction === BranchType.THROUGH) {
        strings.push('keep left to');
      } else {
        strings.push(`use the ${numLeftLanes} left lanes to`);
      }
    } else if (numRightLanes > 1) {
      if (maneuver.direction === BranchType.THROUGH) {
        strings.push('keep right to');
      } else {
        strings.push(`use the ${numRightLanes} right lanes to`);
      }
    } else if (numLeftLanes === 1) {
      if (maneuver.direction === BranchType.THROUGH) {
        strings.push('keep left to');
      } else {
        strings.push('use the left lane to');
      }
    } else if (numRightLanes === 1) {
      if (maneuver.direction === BranchType.THROUGH) {
        strings.push('keep right to');
      } else {
        strings.push('use the right lane to');
      }
    } else {
      const activeIndices = [];
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].activeBranch != null) {
          activeIndices.push(i);
        }
      }
      assert(activeIndices.length > 0);
      if (activeIndices.length === 1) {
        const num = activeIndices[0] + 1;
        if (num <= lanes.length / 2) {
          strings.push(
            `use the ${getNumberWithOrdinal(num)} lane from the left to`,
          );
        } else {
          strings.push(
            `use the ${getNumberWithOrdinal(lanes.length - num + 1)} lane from the right to`,
          );
        }
      }
    }
  }

  let textType: 'exit' | 'name' | 'none' = 'none';
  if (maneuver.banner?.text != null) {
    textType = maneuver.banner.text.toLowerCase().startsWith('exit')
      ? 'exit'
      : 'name';
  }

  if (textType === 'exit') {
    strings.push('take');
    strings.push(maneuver.banner!.text!.toLowerCase());
  } else {
    switch (maneuver.direction) {
      case BranchType.THROUGH:
        strings.push('continue straight');
        break;
      case BranchType.SLIGHT_LEFT:
        strings.push('turn slightly left');
        break;
      case BranchType.LEFT:
        strings.push('turn left');
        break;
      case BranchType.SHARP_LEFT:
        strings.push('turn sharply left');
        break;
      case BranchType.SLIGHT_RIGHT:
        strings.push('turn slightly right');
        break;
      case BranchType.RIGHT:
        strings.push('turn right');
        break;
      case BranchType.SHARP_RIGHT:
        strings.push('turn sharply right');
        break;
      case BranchType.U_TURN_LEFT:
      case BranchType.U_TURN_RIGHT:
        strings.push('make a U-turn');
        break;
      case BranchType.MERGE:
        strings.push('merge');
        break;
      case BranchType.DEPART:
        strings.push('follow the route');
        break;
      case BranchType.ARRIVE:
        strings.push(
          `arrive at ${textType !== 'none' ? maneuver.banner!.text! : 'your destination'}`,
        );
        break;
      case BranchType.FERRY:
        strings.push(`take the ferry to ${assertExists(maneuver.banner).text}`);
        break;
      default:
        throw new UnreachableError(maneuver.direction);
    }
  }

  if (
    textType === 'name' &&
    maneuver.direction !== BranchType.ARRIVE &&
    maneuver.direction !== BranchType.FERRY
  ) {
    strings.push('onto');
    strings.push(maneuver.banner!.text!);
  }

  const string = strings.join(' ');
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// https://stackoverflow.com/a/31615643
function getNumberWithOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// TODO unify with demo app.
const enum LocationType {
  IN_CITY,
  NEAR_CITY,
  IN_STATE,
}

function classifyLocation(
  name: string,
  nearestCity: { name: string; stateCode: string; distance: number },
): LocationType {
  if (
    nearestCity.distance <= 250 ||
    name.startsWith(nearestCity.name) ||
    name.endsWith(nearestCity.name)
  ) {
    return LocationType.IN_CITY;
  } else if (nearestCity.distance <= 1000) {
    return LocationType.NEAR_CITY;
  } else {
    return LocationType.IN_STATE;
  }
}

export function toLocationString(search: SearchResult): string {
  switch (search.type) {
    case 'city':
    case 'scenery':
      return `${search.label}, ${search.stateCode}`;
    case 'company':
    case 'landmark':
    case 'viewpoint':
    case 'ferry':
    case 'train':
    case 'dealer': {
      const location = classifyLocation(search.label, search.city);
      switch (location) {
        case LocationType.IN_CITY:
          return `${search.city.name}, ${search.stateCode}`;
        case LocationType.NEAR_CITY:
          return `near ${search.city.name}, ${search.stateCode}`;
        case LocationType.IN_STATE:
          return `${search.stateName}`;
        default:
          throw new UnreachableError(location);
      }
    }
    default:
      throw new UnreachableError(search);
  }
}

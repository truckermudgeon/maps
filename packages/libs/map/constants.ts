import { assert } from '@truckermudgeon/base/assert';
import type { FacilityIcon, LabeledPoi, LaneSpeedClass, Poi } from './types';

export enum AtsDlc {
  Arizona,
  Arkansas,
  Colorado,
  Idaho,
  Iowa,
  Kansas,
  Missouri,
  Montana,
  Nebraska,
  Nevada,
  NewMexico,
  Oklahoma,
  Oregon,
  Texas,
  Utah,
  Washington,
  Wyoming,
}
export type AtsSelectableDlc = AtsDlc;
export const AtsSelectableDlcs: ReadonlySet<AtsSelectableDlc> = new Set([
  AtsDlc.Nevada,
  AtsDlc.Arizona,
  AtsDlc.NewMexico,
  AtsDlc.Oregon,
  AtsDlc.Washington,
  AtsDlc.Utah,
  AtsDlc.Idaho,
  AtsDlc.Colorado,
  AtsDlc.Wyoming,
  AtsDlc.Montana,
  AtsDlc.Texas,
  AtsDlc.Oklahoma,
  AtsDlc.Kansas,
  AtsDlc.Nebraska,
  AtsDlc.Arkansas,
  AtsDlc.Missouri,
  AtsDlc.Iowa,
]);
export const AtsDlcInfo: Record<AtsSelectableDlc, string> = {
  [AtsDlc.Nevada]: 'Nevada',
  [AtsDlc.Arizona]: 'Arizona',
  [AtsDlc.NewMexico]: 'New Mexico',
  [AtsDlc.Oregon]: 'Oregon',
  [AtsDlc.Washington]: 'Washington',
  [AtsDlc.Utah]: 'Utah',
  [AtsDlc.Idaho]: 'Idaho',
  [AtsDlc.Colorado]: 'Colorado',
  [AtsDlc.Wyoming]: 'Wyoming',
  [AtsDlc.Montana]: 'Montana',
  [AtsDlc.Texas]: 'Texas',
  [AtsDlc.Oklahoma]: 'Oklahoma',
  [AtsDlc.Kansas]: 'Kansas',
  [AtsDlc.Nebraska]: 'Nebraska',
  [AtsDlc.Arkansas]: 'Arkansas',
  [AtsDlc.Missouri]: 'Missouri',
  [AtsDlc.Iowa]: 'Iowa',
};

// from /def/country.sii
// values are based on country_id values in <state>.sui files.
export enum AtsCountryId {
  // Released
  California = 1,
  Nevada = 2,
  Arizona = 3,
  Colorado = 7,
  Idaho = 13,
  Iowa = 21,
  Nebraska = 18,
  Arkansas = 19,
  NewMexico = 31,
  Oregon = 37,
  Texas = 43,
  Utah = 44,
  Washington = 47,
  Kansas = 17,
  Montana = 27,
  Oklahoma = 36,
  Wyoming = 50,
  Missouri = 26,
}

export type AtsDlcGuard = Range<0, 47>;

// key/vals based on dlc guards dropdown in map editor UI
export const AtsDlcGuards: Record<AtsDlcGuard, ReadonlySet<AtsDlc>> = {
  0: new Set(),
  1: new Set([AtsDlc.Nevada]),
  2: new Set([AtsDlc.Arizona]),
  3: new Set([AtsDlc.NewMexico]),
  4: new Set([AtsDlc.Oregon]),
  5: new Set([AtsDlc.Washington]),
  6: new Set([AtsDlc.Washington, AtsDlc.Oregon]),
  7: new Set([AtsDlc.Utah]),
  8: new Set([AtsDlc.Utah, AtsDlc.NewMexico]),
  9: new Set([AtsDlc.Idaho]),
  10: new Set([AtsDlc.Idaho, AtsDlc.Oregon]),
  11: new Set([AtsDlc.Idaho, AtsDlc.Utah]),
  12: new Set([AtsDlc.Idaho, AtsDlc.Washington]),
  13: new Set([AtsDlc.Colorado]),
  14: new Set([AtsDlc.Colorado, AtsDlc.NewMexico]),
  15: new Set([AtsDlc.Colorado, AtsDlc.Utah]),
  16: new Set([AtsDlc.Wyoming]),
  17: new Set([AtsDlc.Wyoming, AtsDlc.Colorado]),
  18: new Set([AtsDlc.Wyoming, AtsDlc.Idaho]),
  19: new Set([AtsDlc.Wyoming, AtsDlc.Utah]),
  20: new Set([AtsDlc.Texas]),
  21: new Set([AtsDlc.Texas, AtsDlc.NewMexico]),
  22: new Set([AtsDlc.Montana]),
  23: new Set([AtsDlc.Montana, AtsDlc.Idaho]),
  24: new Set([AtsDlc.Montana, AtsDlc.Wyoming]),
  25: new Set([AtsDlc.Oklahoma]),
  26: new Set([AtsDlc.Oklahoma, AtsDlc.Colorado]),
  27: new Set([AtsDlc.Oklahoma, AtsDlc.NewMexico]),
  28: new Set([AtsDlc.Oklahoma, AtsDlc.Texas]),
  29: new Set([AtsDlc.Kansas]),
  30: new Set([AtsDlc.Kansas, AtsDlc.Colorado]),
  31: new Set([AtsDlc.Kansas, AtsDlc.Oklahoma]),
  32: new Set([AtsDlc.Nebraska]),
  33: new Set([AtsDlc.Nebraska, AtsDlc.Colorado]),
  34: new Set([AtsDlc.Nebraska, AtsDlc.Kansas]),
  35: new Set([AtsDlc.Nebraska, AtsDlc.Wyoming]),
  36: new Set([AtsDlc.Arkansas]),
  37: new Set([AtsDlc.Arkansas, AtsDlc.Oklahoma]),
  38: new Set([AtsDlc.Arkansas, AtsDlc.Texas]),
  39: new Set([AtsDlc.Missouri]),
  40: new Set([AtsDlc.Missouri, AtsDlc.Arkansas]),
  41: new Set([AtsDlc.Missouri, AtsDlc.Kansas]),
  42: new Set([AtsDlc.Missouri, AtsDlc.Nebraska]),
  43: new Set([AtsDlc.Missouri, AtsDlc.Oklahoma]),
  44: new Set([AtsDlc.Iowa]),
  45: new Set([AtsDlc.Iowa, AtsDlc.Missouri]),
  46: new Set([AtsDlc.Iowa, AtsDlc.Nebraska]),
} as const;

// values are based on matching singleton sets in `AtsDlcGuards` map, e.g.:
// Colorado is 13 because `AtsDlcGuards[13]` is the singleton set of Colorado.
export const AtsCountryIdToDlcGuard: Record<AtsCountryId, AtsDlcGuard> = {
  // Base Map
  [AtsCountryId.California]: 0,
  [AtsCountryId.Nevada]: 1,
  [AtsCountryId.Arizona]: 2,
  // DLCs
  [AtsCountryId.Colorado]: 13,
  [AtsCountryId.Idaho]: 9,
  [AtsCountryId.NewMexico]: 3,
  [AtsCountryId.Oregon]: 4,
  [AtsCountryId.Texas]: 20,
  [AtsCountryId.Utah]: 7,
  [AtsCountryId.Washington]: 5,
  [AtsCountryId.Kansas]: 29,
  [AtsCountryId.Montana]: 22,
  [AtsCountryId.Oklahoma]: 25,
  [AtsCountryId.Wyoming]: 16,
  [AtsCountryId.Nebraska]: 32,
  [AtsCountryId.Arkansas]: 36,
  [AtsCountryId.Missouri]: 39,
  [AtsCountryId.Iowa]: 44,
};

// sanity check to ensure values in record above refer to singleton sets.
for (const dlcGuard of Object.values(AtsCountryIdToDlcGuard)) {
  if (dlcGuard === 0) {
    // special case: California isn't a DLC. Its associated set is empty.
    continue;
  }
  assert(AtsDlcGuards[dlcGuard].size === 1);
}

export function toAtsDlcGuards(
  selectedDlcs: ReadonlySet<AtsSelectableDlc>,
): Set<AtsDlcGuard> {
  const guards = new Set<AtsSelectableDlc>();
  for (const [key, dlcs] of Object.entries(AtsDlcGuards)) {
    if ([...dlcs].every(dlc => selectedDlcs.has(dlc))) {
      guards.add(Number(key));
    }
  }
  return guards;
}

enum Ets2Dlc {
  GoingEast,
  Scandinavia,
  ViveLaFrance,
  Italia,
  BeyondTheBalticSea,
  RoadToTheBlackSea,
  Iberia,
  WestBalkans,
  HeartOfRussia,
  // Truck DLCs
  /** Krone factory in Werlte, Germany. */
  Krone,
  /** Feldbinder factory in Winsen, Germany. */
  Feldbinder,
  Greece,
}
export type Ets2SelectableDlc = Exclude<
  Ets2Dlc,
  Ets2Dlc.HeartOfRussia | Ets2Dlc.Krone | Ets2Dlc.Feldbinder
>;
export const Ets2SelectableDlcs: ReadonlySet<Ets2SelectableDlc> = new Set([]);

export const Ets2DlcGuards: Record<number, ReadonlySet<Ets2Dlc>> = {
  0: new Set(),
  1: new Set([Ets2Dlc.GoingEast]),
  2: new Set([Ets2Dlc.Scandinavia]),
  3: new Set([Ets2Dlc.ViveLaFrance]),
  4: new Set([Ets2Dlc.Italia]),
  5: new Set([Ets2Dlc.Italia, Ets2Dlc.ViveLaFrance]),
  6: new Set([Ets2Dlc.BeyondTheBalticSea]),
  7: new Set([Ets2Dlc.BeyondTheBalticSea, Ets2Dlc.GoingEast]),
  8: new Set([Ets2Dlc.BeyondTheBalticSea, Ets2Dlc.Scandinavia]),
  9: new Set([Ets2Dlc.RoadToTheBlackSea]),
  10: new Set([Ets2Dlc.RoadToTheBlackSea, Ets2Dlc.GoingEast]),
  11: new Set([Ets2Dlc.Iberia]),
  12: new Set([Ets2Dlc.Iberia, Ets2Dlc.ViveLaFrance]),
  13: new Set([Ets2Dlc.HeartOfRussia]),
  14: new Set([Ets2Dlc.HeartOfRussia, Ets2Dlc.BeyondTheBalticSea]),
  15: new Set([Ets2Dlc.Krone]),
  16: new Set([Ets2Dlc.WestBalkans]),
  17: new Set([Ets2Dlc.WestBalkans, Ets2Dlc.GoingEast]),
  18: new Set([Ets2Dlc.WestBalkans, Ets2Dlc.BeyondTheBalticSea]),
  19: new Set([Ets2Dlc.Feldbinder]),
  20: new Set([Ets2Dlc.Greece]),
  21: new Set([Ets2Dlc.Greece, Ets2Dlc.GoingEast]),
  22: new Set([Ets2Dlc.Greece, Ets2Dlc.WestBalkans]),
};

// names, color values defined in def/map_data.sii
export enum MapAreaColor {
  Road = 0,
  Light,
  Dark,
  Green,
  NavRed,
  NavGreen,
  NavBlue,
  NavYellow,
  NavPurple,
}

export const MapAreaColorUtils = {
  from: (n: number) => {
    switch (n) {
      case 0:
        return MapAreaColor.Road;
      case 1:
        return MapAreaColor.Light;
      case 2:
        return MapAreaColor.Dark;
      case 3:
        return MapAreaColor.Green;
      case 4:
        return MapAreaColor.NavRed;
      case 5:
        return MapAreaColor.NavGreen;
      case 6:
        return MapAreaColor.NavBlue;
      case 7:
        return MapAreaColor.NavYellow;
      case 8:
        return MapAreaColor.NavPurple;
      default:
        throw new Error('unknown MapAreaColor: ' + n);
    }
  },
};

export enum MapOverlayType {
  Road = 0,
  Parking = 1,
  Landmark = 4,
}

export const MapOverlayTypeUtils = {
  from: (n: number) => {
    switch (n) {
      case 0:
        return MapOverlayType.Road;
      case 1:
        return MapOverlayType.Parking;
      case 4:
        return MapOverlayType.Landmark;
      default:
        throw new Error('unknown MapOverlayType: ' + n);
    }
  },
};

export enum ItemType {
  Terrain = 1,
  Building = 2,
  Road = 3,
  Prefab = 4,
  Model = 5,
  Company = 6,
  Service = 7,
  CutPlane = 8,
  Mover = 9,
  NoWeather = 11,
  City = 12,
  Hinge = 13,
  MapOverlay = 18,
  Ferry = 19,
  Sound = 21,
  Garage = 22,
  CameraPoint = 23,
  Trigger = 34,
  FuelPump = 35, // services
  Sign = 36, // sign
  BusStop = 37,
  TrafficRule = 38, // traffic_area
  BezierPatch = 39,
  Compound = 40,
  TrajectoryItem = 41,
  MapArea = 42,
  FarModel = 43,
  Curve = 44,
  CameraPath = 45,
  Cutscene = 46,
  Hookup = 47,
  VisibilityArea = 48,
  Gate = 49,
}

// values from https://github.com/SCSSoftware/BlenderTools/blob/master/addon/io_scs_tools/consts.py
export enum SpawnPointType {
  None = 0,
  TrailerPos = 1,
  UnloadEasyPos = 2,
  GasPos = 3,
  ServicePos = 4,
  TruckStopPos = 5,
  WeightStationPos = 6,
  TruckDealerPos = 7,
  Hotel = 8,
  Custom = 9,
  Parking = 10, // also shows parking in companies which don't work/show up in game
  Task = 11,
  MeetPos = 12,
  CompanyPos = 13,
  GaragePos = 14, // manage garage
  BuyPos = 15, // buy garage
  RecruitmentPos = 16,
  CameraPoint = 17,
  BusStation = 18,
  UnloadMediumPos = 19,
  UnloadHardPos = 20,
  UnloadRigidPos = 21,
  WeightCatPos = 22,
  CompanyUnloadPos = 23,
  TrailerSpawn = 24,
  LongTrailerPos = 25,
}

export const FacilitySpawnPointTypes = new Set([
  SpawnPointType.GasPos,
  SpawnPointType.ServicePos,
  SpawnPointType.WeightStationPos,
  SpawnPointType.TruckDealerPos,
  SpawnPointType.BuyPos,
  SpawnPointType.RecruitmentPos,
]);

export function toFacilityIcon(spawnPointType: SpawnPointType): FacilityIcon {
  switch (spawnPointType) {
    case SpawnPointType.GasPos:
      return 'gas_ico';
    case SpawnPointType.ServicePos:
      return 'service_ico';
    case SpawnPointType.WeightStationPos:
      return 'weigh_station_ico';
    case SpawnPointType.TruckDealerPos:
      return 'dealer_ico';
    case SpawnPointType.BuyPos:
      return 'garage_large_ico';
    case SpawnPointType.RecruitmentPos:
      return 'recruitment_ico';
    default:
      throw new Error(`${spawnPointType} is not a facility`);
  }
}

const laneSpeedClassRecord: Record<LaneSpeedClass, true> = {
  dividedRoad: true,
  expressway: true,
  freeway: true,
  localRoad: true,
  motorway: true,
  slowRoad: true,
};
export const isLaneSpeedClass = (s: string): s is LaneSpeedClass =>
  Object.prototype.hasOwnProperty.call(laneSpeedClassRecord, s);

export const isLabeledPoi = (poi: Poi): poi is LabeledPoi =>
  poi.type === 'company' ||
  poi.type === 'landmark' ||
  poi.type === 'viewpoint' ||
  poi.type === 'ferry' ||
  poi.type === 'train';

type Enumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>;

/** Defines a type from [F, T). */
type Range<F extends number, T extends number> = Exclude<
  Enumerate<T>,
  Enumerate<F>
>;

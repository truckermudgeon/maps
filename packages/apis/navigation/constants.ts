export enum PoiType {
  COMPANY,
  FUEL,
  REST,
  SERVICE,
  DEALER,
  RECRUITING,
}

export enum ScopeType {
  NEARBY,
  ROUTE,
}

export const enum BranchType {
  THROUGH,
  SLIGHT_LEFT,
  LEFT,
  SHARP_LEFT,
  U_TURN_LEFT,
  SLIGHT_RIGHT = 11,
  RIGHT,
  SHARP_RIGHT,
  U_TURN_RIGHT,
  MERGE = -1,
  DEPART = -2,
  ARRIVE = -3,
  FERRY = -4,
}

export const turnBranchTypes: ReadonlySet<BranchType> = new Set<BranchType>([
  BranchType.SLIGHT_LEFT,
  BranchType.LEFT,
  BranchType.SHARP_LEFT,
  BranchType.SLIGHT_RIGHT,
  BranchType.RIGHT,
  BranchType.SHARP_RIGHT,
]);

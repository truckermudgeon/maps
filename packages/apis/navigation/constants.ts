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
  // left turns: 1 -- 10
  SLIGHT_LEFT,
  LEFT,
  SHARP_LEFT,
  U_TURN_LEFT,
  // right turns: 11 -- 20
  SLIGHT_RIGHT = 11,
  RIGHT,
  SHARP_RIGHT,
  U_TURN_RIGHT,
  // roundabouts: 21 -- 29
  ROUND_BR = 21,
  ROUND_R,
  ROUND_TR,
  ROUND_T,
  ROUND_TL,
  ROUND_L,
  ROUND_BL,
  ROUND_B,
  ROUND_EXIT,

  // misc.
  MERGE = -1,
  DEPART = -2,
  ARRIVE = -3,
  FERRY = -4,
}

export type RoundaboutBranchType =
  | BranchType.ROUND_BR
  | BranchType.ROUND_R
  | BranchType.ROUND_TR
  | BranchType.ROUND_T
  | BranchType.ROUND_TL
  | BranchType.ROUND_L
  | BranchType.ROUND_BL
  | BranchType.ROUND_B;

const roundaboutBranchTypes = new Set([
  BranchType.ROUND_BR,
  BranchType.ROUND_R,
  BranchType.ROUND_TR,
  BranchType.ROUND_T,
  BranchType.ROUND_TL,
  BranchType.ROUND_L,
  BranchType.ROUND_BL,
  BranchType.ROUND_B,
]);
export function isRoundaboutBranchType(
  branch: BranchType,
): branch is RoundaboutBranchType {
  return roundaboutBranchTypes.has(branch);
}

export type NonRoundaboutBranchType = Exclude<BranchType, RoundaboutBranchType>;

export type NonTerminalBranchType = Exclude<
  BranchType,
  BranchType.DEPART | BranchType.ARRIVE
>;

export const pairingCodeTtlMs = 10 * 60_000;

// Window after the last positionUpdate before subscribeToDevice declares
// the binding stale and yields a staleBinding event.
export const staleBindingTimeoutMs = 10_000;

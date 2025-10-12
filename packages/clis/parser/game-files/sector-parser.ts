import { normalizeRadians } from '@truckermudgeon/base/geom';
import {
  ItemType,
  MapAreaColorUtils,
  MapOverlayTypeUtils,
} from '@truckermudgeon/map/constants';
import type {
  BaseItem,
  Building,
  CityArea,
  CompanyItem,
  Curve,
  Cutscene,
  FerryItem,
  MapArea,
  MapOverlay,
  Model,
  Node,
  Prefab,
  Road,
  Sign,
  Terrain,
  TrajectoryItem,
  Trigger,
} from '@truckermudgeon/map/types';
import type { BaseOf } from 'restructure';
import * as r from 'restructure';
import { logger } from '../logger';
import {
  float3,
  float4,
  paddedString,
  token64,
  uint64String,
  uint64le,
} from './restructure-helpers';

// struct definitions derived from https://github.com/dariowouters/ts-map/blob/master/docs/structures/base/875/base-template.bt
// https://github.com/sk-zk/map-docs/wiki/Map-format

const quadInfo = new r.Struct({
  materials: new r.Array(
    new r.Struct({
      token: token64,
      rot: r.uint16le,
    }),
    r.uint16le,
  ),
  colors: new r.Array(r.uint32le, r.uint16le),
  sizeX: r.uint16le,
  sizeY: r.uint16le,
  storage: new r.Array(r.uint32le, r.uint32le),
  offsets: new r.Array(
    new r.Struct({
      x: r.uint16le,
      y: r.uint16le,
      normal: float3,
    }),
    r.uint32le,
  ),
  normals: new r.Array(
    new r.Struct({
      x: r.uint16le,
      y: r.uint16le,
      normal: float3,
    }),
    r.uint32le,
  ),
});

const vegetationSpheres = new r.Array(
  new r.Struct({
    center: float3,
    radius: r.floatle,
    type: r.uint32le,
  }),
  r.uint32le,
);

const SimpleItemStruct = {
  header: {
    // Note: care must be taken to _not_ reuse header keys
    // in the versioned struct keys below, as the keys get
    // merged during decoding.
    uid: uint64le,
    pos: float3,
    posR: float3,
    rot: float3,
    padding: new r.Reserved(r.floatle, 1),
    flags: r.uint32le,
    viewDistance: r.uint8,
    // uncomment this to get console output of the above item headers.
    // useful for finding node UIDs of items that may have changed between
    // game versions.
    //debugStruct,
  },
  [ItemType.Terrain]: {
    startNodeUid: uint64le,
    endNodeUid: uint64le,
    node0Offset: float3,
    node1Offset: float3,
    length: r.floatle,
    previousLength: r.floatle,
    randomSeed: r.uint32le,
    railings: new r.Array(
      new r.Struct({
        token: token64,
        offset: r.uint16le,
      }),
      3,
    ),
    terrains: new r.Array(
      new r.Struct({
        size: r.uint16le,
        profile: token64,
        coef: r.floatle,
        prevProfile: token64,
        prevCoef: r.floatle,
        vegetation: new r.Array(
          new r.Struct({
            token: token64,
            density: r.uint16le,
            highPolyDistance: r.uint8,
            scaleType: r.uint8,
            start: r.uint16le,
            end: r.uint16le,
          }),
          3,
        ),
        dvdm: r.uint16le,
        dvd: r.uint16le,
      }),
      2,
    ),
    vegetationSpheres,
    rightQuad: quadInfo,
    leftQuad: quadInfo,
    rightEdge: token64,
    rightEdgeLook: token64,
    leftEdge: token64,
    leftEdgeLook: token64,
  },
  [ItemType.Building]: {
    scheme: token64,
    lookOverride: token64,
    startNodeUid: uint64le,
    endNodeUid: uint64le,
    length: r.floatle,
    seed: r.uint32le,
    stretchCoef: r.floatle,
    heightOffsets: new r.Array(r.floatle, r.uint32le),
  },
  [ItemType.Road]: {
    flags1: r.uint8,
    dlcGuard: r.uint8,
    flags2: r.uint16le,

    roadLook: token64,

    rightLanesVariant: token64,
    leftLanesVariant: token64,

    rightTemplateVariant: token64,
    leftTemplateVariant: token64,

    rightEdgeRight: token64,
    rightEdgeLeft: token64,
    leftEdgeRight: token64,
    leftEdgeLeft: token64,

    rightProfile: token64,
    rightProfileCoef: r.floatle,
    leftProfile: token64,
    leftProfileCoef: r.floatle,

    rightTemplateLook: token64,
    leftTemplateLook: token64,

    material: token64,

    railings: new r.Array(
      new r.Struct({
        rightRailing: token64,
        rightRailingOffset: r.int16le,
        leftRailing: token64,
        leftRailingOffset: r.int16le,
      }),
      3,
    ),

    rightRoadHeight: r.int32le,
    leftRoadHeight: r.int32le,

    startNodeUid: uint64le,
    endNodeUid: uint64le,

    length: r.floatle,
  },
  [ItemType.Prefab]: {
    model: token64,
    variant: token64,
    parts: new r.Array(token64, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
    connectedItemUids: new r.Array(uint64le, r.uint32le),
    ferryLink: uint64le,
    originIndex: r.uint16le,
    terrainInfos: new r.Array(
      new r.Struct({
        token: token64,
        coef: r.floatle,
      }),
      (parent: { nodeUids: unknown[] }) => parent.nodeUids.length,
    ),
    semaphoreProfile: token64,
  },
  [ItemType.Model]: {
    token: token64,
    look: token64,
    variant: token64,
    addParts: new r.Array(token64, r.uint32le),
    nodeUid: uint64le,
    scale: float3,
    material: token64,
    color: r.uint32le,
    terrainRot: r.floatle,
  },
  [ItemType.Company]: {
    cityName: token64,
    prefabUid: uint64le,
    overlayName: token64,
    nodeUid: uint64le,
    nodes: new r.Array(
      new r.Struct({
        nodeUid: uint64le,
        nodeFlag: r.uint32le,
      }),
      r.uint32le,
    ),
  },
  [ItemType.Service]: {
    nodeUid: uint64le,
    prefabUid: uint64le,
    subItemUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.CutPlane]: {
    nodeUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.Mover]: {
    tags: new r.Array(token64, r.uint32le),
    model: token64,
    look: token64,
    variant: token64,
    speed: r.floatle,
    endDelay: r.floatle,
    width: r.floatle,
    count: r.uint32le,
    lengths: new r.Array(r.floatle, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.NoWeather]: {
    width: r.floatle,
    height: r.floatle,
    fogMaskPresetId: r.int32le,
    // new in v901.
    unknown: new r.Reserved(r.uint8, 16),
    nodeUid: uint64le,
  },
  [ItemType.City]: {
    token: token64,
    width: r.floatle,
    height: r.floatle,
    nodeUid: uint64le,
  },
  [ItemType.Hinge]: {
    token: token64,
    look: token64,
    nodeUid: uint64le,
    minRot: r.floatle,
    maxRot: r.floatle,
  },
  [ItemType.MapOverlay]: {
    name: token64,
    nodeUid: uint64le,
  },
  [ItemType.Ferry]: {
    ferryPort: token64,
    prefabUid: uint64le,
    nodeUid: uint64le,
    unloadOffset: float3,
  },
  [ItemType.Garage]: {
    cityName: token64,
    // TODO verify type and nodeUid values and prefab values
    type: r.uint32le,
    nodeUid: uint64le,
    prefabUid: uint64le,
    childItemUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.CameraPoint]: {
    tags: new r.Array(token64, r.uint32le),
    nodeUid: uint64le,
  },
  [ItemType.Trigger]: {
    tags: new r.Array(token64, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
    actions: new r.Array(
      new r.Struct({
        action: token64,
        hasOverride: r.int32le,
        overrideValues: new r.Array(r.uint32le, 'hasOverride'),
        override: new r.Optional(
          new r.Struct({
            params: new r.Array(uint64String, r.uint32le),
            targetTags: new r.Array(uint64le, r.uint32le),
            range: r.floatle,
            type: r.uint32le,
          }),
          (parent: { hasOverride: number }) => parent.hasOverride >= 0,
        ),
      }),
      r.uint32le,
    ),
    radius: new r.Optional(
      r.floatle,
      (parent: { nodeUids: unknown[] }) => parent.nodeUids.length === 1,
    ),
  },
  [ItemType.FuelPump]: {
    nodeUid: uint64le,
    prefabUid: uint64le,
    childItemUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.Sign]: {
    token: token64,
    nodeUid: uint64le,
    look: token64,
    variant: token64,
    boards: new r.Array(
      new r.Struct({
        token: token64,
        city1: token64,
        city2: token64,
      }),
      r.uint8,
    ),
    overrideTemplate: paddedString,
    overrides: new r.Struct({
      items: new r.Array(
        new r.Struct({
          id: r.uint32le,
          areaName: token64,
          attributes: new r.Array(
            new r.VersionedStruct(r.uint16le, {
              header: {
                index: r.uint32le,
              },
              1: {
                value: r.int8,
              },
              2: {
                value: r.int32le,
              },
              3: {
                value: r.uint32le,
              },
              4: {
                value: r.floatle,
              },
              5: {
                value: uint64String,
              },
              6: {
                value: uint64le,
              },
            }),
            r.uint32le,
          ),
        }),
        r.uint32le,
      ),
    }),
  },
  [ItemType.BusStop]: {
    cityName: token64,
    prefabUid: uint64le,
    nodeUid: uint64le,
  },
  // Possibly useful for mapping?
  [ItemType.TrafficRule]: {
    tags: new r.Array(token64, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
    ruleId: token64,
    range: r.floatle,
  },
  [ItemType.BezierPatch]: {
    controlPoints: new r.Array(float3, 16),
    xTess: r.uint16le,
    zTess: r.uint16le,
    nodeUid: uint64le,
    randomSeed: r.uint32le,
    vegetation: new r.Array(
      new r.Struct({
        token: token64,
        sparsity: r.uint16le,
        scale: r.uint8,
      }),
      3,
    ),
    vegetationSpheres,
    quadInfo,
  },
  [ItemType.TrajectoryItem]: {
    nodeUids: new r.Array(uint64le, r.uint32le),
    flags2: uint64le,
    routeRules: new r.Array(
      new r.Struct({
        node: r.uint32le,
        rule: token64,
        padding: new r.Reserved(r.uint32le),
        params: float3,
      }),
      r.uint32le,
    ),
    checkpoints: new r.Array(
      new r.Struct({
        route: token64,
        checkpoint: token64,
      }),
      r.uint32le,
    ),
    tags: new r.Array(token64, r.uint32le),
  },
  [ItemType.MapArea]: {
    nodeUids: new r.Array(uint64le, r.uint32le),
    colorIndex: r.uint32le,
  },
  [ItemType.FarModel]: {
    width: r.floatle,
    height: r.floatle,
    models: new r.Array(
      new r.Struct({
        token: token64,
        scale: float3,
      }),
      r.uint32le,
    ),
    childUids: new r.Array(uint64le, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.Curve]: {
    model: token64,
    startNodeUid: uint64le,
    endNodeUid: uint64le,
    paddingUids: new r.Array(uint64le, 2),
    length: r.floatle,
    randomSeed: r.uint32le,
    stretchCoef: r.floatle,
    scale: r.floatle,
    fixedStep: r.floatle,
    material: token64,
    color: r.uint32le,
    terrainRot: r.floatle,
    firstPart: token64,
    lastPart: token64,
    centerPartVariation: token64,
    modelLook: token64,
    heightOffsets: new r.Array(r.floatle, r.uint32le),
  },
  [ItemType.CameraPath]: {
    tags: new r.Array(token64, r.uint32le),
    nodeUids: new r.Array(uint64le, r.uint32le),
    trackPointNodeUids: new r.Array(uint64le, r.uint32le),
    curveControlNodeUids: new r.Array(uint64le, r.uint32le),
    keyFrames: new r.Array(
      new r.Struct({
        speedChange: r.int32le,
        rotationChange: r.int32le,
        speedCoef: r.floatle,
        fov: r.floatle,
        backwardTangentPos: float3,
        forwardTangentPos: float3,
      }),
      r.uint32le,
    ),
    speed: r.floatle,
  },
  [ItemType.Cutscene]: {
    tags: new r.Array(token64, r.uint32le),
    nodeUid: uint64le,
    actions: new r.Array(
      new r.Struct({
        params: new r.Array(r.uint32le, r.uint32le),
        stringParams: new r.Array(uint64String, r.uint32le),
        targetTags: new r.Array(uint64le, r.uint32le),
        range: r.floatle,
        actionFlags: r.uint32le,
      }),
      r.uint32le,
    ),
  },
  [ItemType.Hookup]: {
    name: uint64String,
    nodeUid: uint64le,
  },
  [ItemType.VisibilityArea]: {
    nodeUid: uint64le,
    width: r.floatle,
    height: r.floatle,
    childItemUids: new r.Array(uint64le, r.uint32le),
  },
  [ItemType.Gate]: {
    model: token64,
    nodeUids: new r.Array(uint64le, r.uint32le),
    activationPointUnits: new r.Array(
      new r.Struct({
        triggerUnitName: uint64String,
        triggerNodeIndex: r.int32le,
      }),
      2,
    ),
  },
};

const SectorNode = new r.Struct({
  uid: uint64le,
  pos: new r.Array(r.int32le, 3),
  rot: float4,
  backwardItemUid: uint64le,
  forwardItemUid: uint64le,
  flags: r.uint8,
  forwardCountryId: r.uint8,
  backwardCountryId: r.uint8,
  flags2: r.uint8,
});
type SectorNode = BaseOf<typeof SectorNode>;

const SimpleItem = new r.VersionedStruct(r.uint32le, SimpleItemStruct);

const ComplexItem = new r.VersionedStruct(r.uint32le, {
  ...SimpleItemStruct,
  [ItemType.Compound]: {
    nodeUid: uint64le,
    childItems: new r.Array(SimpleItem, r.uint32le),
    childNodes: new r.Array(SectorNode, r.uint32le),
  },
});
type SectorItemKey = BaseOf<typeof ComplexItem>['version'];
type SectorItem<T extends SectorItemKey> = BaseOf<typeof ComplexItem> & {
  version: T;
};

const Sector = new r.Struct({
  version: r.uint32le,
  gameId: token64,
  padding: new r.Reserved(r.uint32le),
  items: new r.Array(ComplexItem, r.uint32le),
  nodes: new r.Array(SectorNode, r.uint32le),
  visibleAreaChildUids: new r.Array(uint64le, r.uint32le),
});

const versionWarnings = new Set<number>();

export function parseSector(
  buffer: Buffer,
  ignoreNodeUids: ReadonlySet<bigint>,
) {
  const version = buffer.readUint32LE();
  if (version !== 903) {
    if (!versionWarnings.has(version)) {
      logger.warn('unknown .base file version', version);
      logger.warn('errors may come up, and parse results may be inaccurate.');
      versionWarnings.add(version);
    }
  }

  const str = new r.DecodeStream(buffer);
  const sector = Sector.decode(str);
  if (str.pos !== buffer.length) {
    logger.error(
      'not enough bytes read; expected / actual',
      buffer.length,
      str.pos,
    );
    throw new Error();
  }
  const simples = {
    items: sector.items
      .map(ri => {
        switch (ri.version) {
          case ItemType.Road:
            return toRoad(ri);
          case ItemType.Prefab:
            return toPrefab(ri);
          case ItemType.MapArea:
            return toMapArea(ri);
          case ItemType.City:
            return toCityArea(ri);
          case ItemType.MapOverlay:
            return toMapOverlay(ri);
          case ItemType.Ferry:
            return toFerry(ri);
          case ItemType.Company:
            return toCompany(ri);
          case ItemType.Cutscene:
            return toCutscene(ri);
          case ItemType.Trigger:
            return toTrigger(ri);
          case ItemType.Sign:
            return toSignWithText(ri);
          case ItemType.Model:
            return toModel(ri);
          case ItemType.Terrain:
            return toTerrain(ri);
          case ItemType.Building:
            return toBuilding(ri);
          case ItemType.Curve:
            return toCurve(ri);
          case ItemType.TrajectoryItem:
            return toTrajectoryItem(ri);
          default:
            return undefined;
        }
      })
      .filter(i => i != null),
    nodes: sector.nodes.reduce<Node[]>((acc, n) => {
      if (!ignoreNodeUids.has(n.uid)) {
        acc.push(toNode(n));
      }
      return acc;
    }, []),
  };
  const moreItems: typeof simples.items = [];
  const moreNodes: Node[] = [];
  for (const ri of sector.items) {
    if (ri.version !== ItemType.Compound) {
      continue;
    }
    for (const ci of ri.childItems) {
      let pushNodes = false;
      if (ci.version === ItemType.Model) {
        moreItems.push(toModel(ci));
        pushNodes = true;
      } else if (ci.version === ItemType.Building) {
        const b = toBuilding(ci);
        if (b) {
          moreItems.push(b);
          pushNodes = true;
        }
      } else if (ci.version === ItemType.Curve) {
        const c = toCurve(ci);
        if (c) {
          moreItems.push(c);
          pushNodes = true;
        }
      }
      if (pushNodes) {
        moreNodes.push(...ri.childNodes.map(toNode));
      }
    }
  }
  return {
    items: simples.items.concat(moreItems),
    nodes: simples.nodes.concat(moreNodes),
  };
}

function toBaseItem<T extends SectorItemKey>(
  rawItem: SectorItem<T>,
): BaseItem & { type: T } {
  return {
    uid: rawItem.uid,
    type: rawItem.version,
    x: rawItem.pos[0],
    y: rawItem.pos[2],
  };
}

function toRoad(rawItem: SectorItem<ItemType.Road>): Road {
  return {
    ...toBaseItem(rawItem),
    dlcGuard: rawItem.dlcGuard,
    //                          ┌─ bit 25 (0-based)
    hidden: (rawItem.flags & 0x02_00_00_00) !== 0 ? true : undefined,
    //                             ┌─ bit 16 (0-based)
    secret: (rawItem.flags & 0x00_01_00_00) !== 0 ? true : undefined,
    roadLookToken: rawItem.roadLook,
    startNodeUid: rawItem.startNodeUid,
    endNodeUid: rawItem.endNodeUid,
    length: rawItem.length,
  };
}

function toPrefab(rawItem: SectorItem<ItemType.Prefab>): Prefab {
  return {
    ...toBaseItem(rawItem),
    dlcGuard: (rawItem.flags & 0x00_00_ff_00) >> 8,
    token: rawItem.model,
    //                             ┌─ bit 17 (0-based)
    hidden: (rawItem.flags & 0x00_02_00_00) !== 0 ? true : undefined,
    //                                  ┌─ bit 5 (0-based)
    secret: (rawItem.flags & 0x00_00_00_20) !== 0 ? true : undefined,
    nodeUids: rawItem.nodeUids,
    originNodeIndex: rawItem.originIndex,
  };
}

function toMapArea(rawItem: SectorItem<ItemType.MapArea>): MapArea {
  return {
    ...toBaseItem(rawItem),
    dlcGuard: (rawItem.flags & 0x00_00_ff_00) >> 8,
    drawOver: (rawItem.flags & 0x00_00_00_01) !== 0 ? true : undefined,
    //                                  ┌─ bit 4 (0-based)
    secret: (rawItem.flags & 0x10_00_00_10) !== 0 ? true : undefined,
    nodeUids: rawItem.nodeUids,
    color: MapAreaColorUtils.from(rawItem.colorIndex),
  };
}

function toCityArea(rawItem: SectorItem<ItemType.City>): CityArea {
  return {
    ...toBaseItem(rawItem),
    token: rawItem.token,
    hidden: (rawItem.flags & 0x01) !== 0,
    width: rawItem.width,
    height: rawItem.height,
  };
}

function toMapOverlay(rawItem: SectorItem<ItemType.MapOverlay>): MapOverlay {
  return {
    ...toBaseItem(rawItem),
    dlcGuard: (rawItem.flags & 0x00_00_ff_00) >> 8,
    //                             ┌─ bit 16 (0-based)
    secret: (rawItem.flags & 0x00_01_00_00) !== 0 ? true : undefined,
    overlayType: MapOverlayTypeUtils.from(rawItem.flags & 0x0f),
    token: rawItem.name,
    nodeUid: rawItem.nodeUid,
  };
}

function toFerry(rawItem: SectorItem<ItemType.Ferry>): FerryItem {
  return {
    ...toBaseItem(rawItem),
    token: rawItem.ferryPort,
    train: (rawItem.flags & 0x01) !== 0,
    prefabUid: rawItem.prefabUid,
    nodeUid: rawItem.nodeUid,
  };
}

function toCompany(rawItem: SectorItem<ItemType.Company>): CompanyItem {
  return {
    ...toBaseItem(rawItem),
    token: rawItem.overlayName,
    cityToken: rawItem.cityName,
    prefabUid: rawItem.prefabUid,
    nodeUid: rawItem.nodeUid,
  };
}

function toCutscene(rawItem: SectorItem<ItemType.Cutscene>): Cutscene {
  return {
    ...toBaseItem(rawItem),
    dlcGuard: (rawItem.flags & 0x00_00_ff_00) >> 8,
    //                         ┌─ bit 28 (0-based)
    secret: (rawItem.flags & 0x10_00_00_00) !== 0 ? true : undefined,
    flags: rawItem.flags,
    tags: rawItem.tags,
    nodeUid: rawItem.nodeUid,
    actionStringParams: rawItem.actions.flatMap(action => action.stringParams),
    // TODO search actions.stringParams "ui_value" for @@ localization string name
  };
}

function toTrigger(rawItem: SectorItem<ItemType.Trigger>): Trigger {
  const actionsMap = new Map(
    rawItem.actions.map(a => [a.action, a.override ? a.override.params : []]),
  );
  return {
    ...toBaseItem(rawItem),
    dlcGuard: (rawItem.flags & 0x00_00_ff_00) >> 8,
    //                             ┌─ bit 18 (0-based)
    secret: (rawItem.flags & 0x00_04_00_00) !== 0 ? true : undefined,
    actions: [...actionsMap.entries()],
    nodeUids: rawItem.nodeUids,
  };
}

// returns `undefined` if no text
function toSignWithText(rawItem: SectorItem<ItemType.Sign>): Sign | undefined {
  const textItems = [];
  for (const attr of rawItem.overrides.items.flatMap(item => item.attributes)) {
    if (attr.version === 5) {
      textItems.push(attr.value);
    }
  }
  if (textItems.length === 0) {
    return undefined;
  }

  return {
    ...toBaseItem(rawItem),
    token: rawItem.token,
    nodeUid: rawItem.nodeUid,
    textItems,
  };
}

function toBuilding(
  rawItem: SectorItem<ItemType.Building>,
): Building | undefined {
  // HACK because of memory issues;
  if (rawItem.scheme !== 'scheme20') {
    return;
  }

  return {
    ...toBaseItem(rawItem),
    scheme: rawItem.scheme,
    startNodeUid: rawItem.startNodeUid,
    endNodeUid: rawItem.endNodeUid,
  };
}

function toCurve(rawItem: SectorItem<ItemType.Curve>): Curve | undefined {
  if (rawItem.model !== '0i03a' && rawItem.model !== '0i03b') {
    return;
  }

  return {
    ...toBaseItem(rawItem),
    model: rawItem.model,
    look: rawItem.modelLook,
    numBuildings: rawItem.heightOffsets.length,
    startNodeUid: rawItem.startNodeUid,
    endNodeUid: rawItem.endNodeUid,
  };
}

function toTrajectoryItem(
  rawItem: SectorItem<ItemType.TrajectoryItem>,
): TrajectoryItem | undefined {
  if (!rawItem.checkpoints.some(c => c.checkpoint === 'offer_point')) {
    return;
  }

  return {
    ...toBaseItem(rawItem),
    nodeUids: rawItem.nodeUids,
    checkpoints: rawItem.checkpoints,
  };
}

function toModel(rawItem: SectorItem<ItemType.Model>): Model {
  const [sx, sy, sz] = rawItem.scale;
  return {
    ...toBaseItem(rawItem),
    token: rawItem.token,
    nodeUid: rawItem.nodeUid,
    scale: { x: sx, y: sz, z: sy },
  };
}

function toTerrain(rawItem: SectorItem<ItemType.Terrain>): Terrain {
  return {
    ...toBaseItem(rawItem),
    startNodeUid: rawItem.startNodeUid,
    endNodeUid: rawItem.endNodeUid,
    length: rawItem.length,
  };
}

function toNode(rawNode: SectorNode): Node {
  const [qw, , qy] = rawNode.rot;
  const rotation = normalizeRadians(Math.atan2(-qy, qw) * 2 - Math.PI / 2);

  return {
    uid: rawNode.uid,
    x: rawNode.pos[0] / 256,
    y: rawNode.pos[2] / 256,
    z: rawNode.pos[1] / 256,
    rotation,
    rotationQuat: rawNode.rot,
    forwardItemUid: rawNode.forwardItemUid,
    backwardItemUid: rawNode.backwardItemUid,
    forwardCountryId: rawNode.forwardCountryId,
    backwardCountryId: rawNode.backwardCountryId,
  };
}

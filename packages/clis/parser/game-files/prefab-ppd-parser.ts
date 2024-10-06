import { assert } from '@truckermudgeon/base/assert';
import { MapColor } from '@truckermudgeon/map/constants';
import type { MapPoint, PrefabDescription } from '@truckermudgeon/map/types';
import * as r from 'restructure';
import { logger } from '../logger';
import { float3, float4, token64 } from './restructure-helpers';

// based on:
// https://github.com/dariowouters/ts-map/blob/master/docs/structures/ppd-template.bt
// https://github.com/SCSSoftware/BlenderTools/blob/master/addon/io_scs_tools/consts.py

const Prefab = new r.Struct({
  version: r.uint32le,

  numNodes: r.uint32le,
  numNavCurves: r.uint32le,
  numSigns: r.uint32le,
  numSemaphores: r.uint32le,
  numSpawnPoints: r.uint32le,
  numTerrainPoints: r.uint32le,
  numTerrainPointVariants: r.uint32le,
  numMapPoints: r.uint32le,
  numTriggerPoints: r.uint32le,
  numIntersections: r.uint32le,
  numNavNodes: r.uint32le,

  nodes: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        terrainPointIndex: r.uint32le,
        terrainPointCount: r.uint32le,
        variantIndex: r.uint32le,
        variantCount: r.uint32le,
        pos: float3,
        rot: float3,
        inputLanes: new r.Array(r.int32le, 8),
        outputLanes: new r.Array(r.int32le, 8),
      }),
      'numNodes',
    ),
  ),
  navCurves: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        token: token64,
        flags: r.uint32le,
        leadsToNodes: new r.Struct({
          // looks like this byte should be treated like the navNode bitfield.
          endNode: r.uint8,
          endLane: r.uint8,
          // looks like this byte should be treated like the navNode bitfield.
          startNode: r.uint8,
          startLane: r.uint8,
        }),
        startPos: float3,
        endPos: float3,
        startRot: float4,
        endRot: float4,
        length: r.floatle,
        nextLines: new r.Array(r.int32le, 4),
        prevLines: new r.Array(r.int32le, 4),
        countNext: r.uint32le, // length of nextLines array, above
        countPrev: r.uint32le, // length of prevLines array, above
        semaphoreId: r.int32le,
        trafficRule: token64,
        navNodeIndex: r.uint32le,
      }),
      'numNavCurves',
    ),
  ),
  signs: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        name: token64,
        pos: float3,
        rot: float4,
        model: token64,
        part: token64,
      }),
      'numSigns',
    ),
  ),
  semaphores: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        pos: float3,
        rot: float4,
        type: r.uint32le,
        id: r.uint32le,
        intervals: float4,
        cycle: r.floatle,
        profile: token64,
        unknown: new r.Reserved(r.uint32le),
      }),
      'numSemaphores',
    ),
  ),
  spawnPoints: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        pos: float3,
        rot: float4,
        type: r.uint32le,
        // new in v24. maybe related to new loading mechanic in Nebraska?
        unknown: new r.Reserved(r.uint32le),
      }),
      'numSpawnPoints',
    ),
  ),
  terrainPointPositions: new r.Pointer(
    r.uint32le,
    new r.Array(float3, 'numTerrainPoints'),
  ),
  terrainPointNormals: new r.Pointer(
    r.uint32le,
    new r.Array(float3, 'numTerrainPoints'),
  ),
  terrainPointVariants: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        attach0: r.uint32le,
        attach1: r.uint32le,
      }),
      'numTerrainPointVariants',
    ),
  ),
  mapPoints: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        visualFlags: new r.Struct({
          extValue: new r.Reserved(r.uint8),
          sizeAndOffset: r.uint8, // first nibble: size, second nibble: offset
          paint: new r.Bitfield(r.uint8, [
            'roadOver',
            'light',
            'dark',
            'green',
            'noOutline',
            'noArrow', // only relevant for 'road' map points
          ]),
          unknown: new r.Reserved(r.uint8),
        }),
        navFlags: new r.Struct({
          navNode: new r.Bitfield(r.uint8, [
            'node0',
            'node1',
            'node2',
            'node3',
            'node4',
            'node5',
            'node6',
            'nodeCustom',
          ]),
          control: new r.Bitfield(r.uint8, ['isStart', 'isBase', 'isExit']),
          unknown: new r.Reserved(r.uint16le),
        }),
        pos: float3,
        neighbors: new r.Array(r.int32le, 6),
        neighborCount: r.uint32le,
      }),
      'numMapPoints',
    ),
  ),
  triggerPoints: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        id: r.uint32le,
        action: token64,
        range: r.floatle,
        resetDelay: r.floatle,
        resetDistance: r.floatle,
        flags: r.uint32le,
        pos: float3,
        neighbors: new r.Array(r.int32le, 2),
      }),
      'numTriggerPoints',
    ),
  ),
  intersections: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        curveId: r.uint32le,
        pos: r.floatle, // position along curve?
        radius: r.floatle,
        flags: r.uint32le,
      }),
      'numIntersections',
    ),
  ),
  navNodes: new r.Pointer(
    r.uint32le,
    new r.Array(
      new r.Struct({
        type: new r.Enum(r.uint8, ['physical', 'ai']),
        // if type is physical: the index of the normal node (see nodes array) this navNode ends at.
        // if type is ai: the index of the AI curve this navNode ends at.
        index: r.uint16le,
        connectionCount: r.uint8,
        // connections to other nav nodes
        connections: new r.Array(
          new r.Struct({
            // target navNode index
            targetNode: r.uint16le,
            length: r.floatle,
            curveIndicesCount: r.uint8,
            curveIndices: new r.Array(r.uint16le, 8),
          }),
          8,
        ), // note: this 8 differs from docs at http://modding.scssoft.com/wiki/Games/ETS2/Modding_guides/1.30#Prefabs, which says it's 4.
      }),
      'numNavNodes',
    ),
  ),
});

const roadSizeToLanes = {
  0: {
    lanesLeft: 0,
    lanesRight: 1,
  },
  1: {
    lanesLeft: 1,
    lanesRight: 1,
  },
  2: {
    lanesLeft: 2,
    lanesRight: 2,
  },
  3: {
    lanesLeft: 3,
    lanesRight: 3,
  },
  4: {
    lanesLeft: 4,
    lanesRight: 4,
  },
  5: {
    lanesLeft: 2,
    lanesRight: 2,
  },
  6: {
    lanesLeft: 3,
    lanesRight: 3,
  },
  7: {
    lanesLeft: 4,
    lanesRight: 4,
  },
  8: {
    lanesLeft: 0,
    lanesRight: 3,
  },
  14: {
    lanesLeft: 'auto' as const,
    lanesRight: 'auto' as const,
  },
};

// values from https://github.com/SCSSoftware/BlenderTools/blob/34dff5239e0f46512af0400a84f6effa5933d4ab/addon/io_scs_tools/consts.py#L395-L402
const roadOffsetToOffset = {
  0: 0,
  1: 1,
  2: 2,
  3: 5,
  4: 10,
  5: 15,
  6: 20,
  7: 25,
};

export function parsePrefabPpd(buffer: Buffer): PrefabDescription {
  const version = buffer.readUint32LE();
  if (version !== 24) {
    logger.error('unknown .ppd file version', version);
    throw new Error();
  }
  const rawPrefab = Prefab.fromBuffer(buffer);

  // TODO verify check. should it be against roadPoints?
  const skipBaseRoads = rawPrefab.mapPoints.length > rawPrefab.nodes.length + 1;

  // see world/traffic_rules.sii
  // const navCurveTrafficRules = new Set<string>();
  // rawPrefab.navCurves.forEach(n => {
  //   const r = n.trafficRule as unknown as string;
  //   if (r !== '') {
  //     navCurveTrafficRules.add(r)
  //   }
  // })
  // if (navCurveTrafficRules.size) {
  //   console.log(navCurveTrafficRules);
  // }

  // make sure that dummy road points are all at the end of the array, so
  // we can trim them out without affecting map point indices.
  let seenDummy = false;
  return {
    nodes: rawPrefab.nodes.map(n => {
      const [rX, , rZ] = n.rot;
      // N.B.: not offsetting / flipping like we do for other nodes, so rotation calcs in
      // `toMapPosition` work.
      // TODO but why, though?
      const rotation = Math.atan2(rZ, rX);
      return {
        x: n.pos[0],
        y: n.pos[2],
        z: n.pos[1],
        rotation,
        inputLanes: n.inputLanes.filter(v => v !== -1),
        outputLanes: n.outputLanes.filter(v => v !== -1),
      };
    }),
    spawnPoints: rawPrefab.spawnPoints.map(rp => {
      return {
        type: rp.type,
        x: rp.pos[0],
        y: rp.pos[2],
      };
    }),
    mapPoints: rawPrefab.mapPoints
      .map<MapPoint | undefined>(rp => {
        const { visualFlags, neighborCount, pos } = rp;
        const isPolygon = (visualFlags.sizeAndOffset & 0x0f) === 13;
        const baseProperties = {
          x: pos[0],
          y: pos[2],
          z: pos[1],
          neighbors: rp.neighbors.slice(0, neighborCount),
        };

        if (isPolygon) {
          assert(!seenDummy);
          const { paint } = rp.visualFlags;
          let color: MapColor = MapColor.Road;
          if (paint.light) {
            color = MapColor.Light;
          } else if (paint.dark) {
            color = MapColor.Dark;
          } else if (paint.green) {
            color = MapColor.Green;
          }
          return {
            ...baseProperties,
            type: 'polygon',
            color,
            roadOver: !!paint.roadOver,
          };
        } else if (skipBaseRoads && rp.navFlags.control.isBase) {
          seenDummy = true;
          return undefined;
        } else {
          assert(!seenDummy);
          let lanesLeft: number | 'auto' = 0;
          let lanesRight: number | 'auto' = 1;
          const roadSize = rp.visualFlags.sizeAndOffset & 0x0f;
          if (roadSize in roadSizeToLanes) {
            const key = roadSize as keyof typeof roadSizeToLanes;
            ({ lanesLeft, lanesRight } = roadSizeToLanes[key]);
          } else {
            logger.warn('unknown road size', roadSize);
          }

          let offset = 0;
          const roadOffset = (rp.visualFlags.sizeAndOffset & 0xf0) >> 4;
          if (roadOffset in roadOffsetToOffset) {
            const key = roadOffset as keyof typeof roadOffsetToOffset;
            offset = roadOffsetToOffset[key];
          } else {
            logger.warn('unknown road size', roadSize);
          }

          if (lanesLeft === 'auto' && lanesRight === 'auto') {
            // read from navFlags; specify that offset should be 'auto'
          }

          return {
            ...baseProperties,
            type: 'road',
            navFlags: rp.navFlags.control,
            navNode: rp.navFlags.navNode,
            lanesLeft,
            lanesRight,
            offset,
          };
        }
      })
      .filter(p => p != null),
    triggerPoints: rawPrefab.triggerPoints.map(rp => {
      const { action, pos } = rp;
      return {
        x: pos[0],
        y: pos[2],
        action,
      };
    }),
    // future fields, useful for routing
    navCurves: rawPrefab.navCurves.map(rc => {
      const {
        navNodeIndex,
        countNext,
        countPrev,
        startPos,
        startRot,
        endPos,
        endRot,
      } = rc;
      const start = getXYZR(startPos, startRot);
      const end = getXYZR(endPos, endRot);
      return {
        navNodeIndex,
        start,
        end,
        nextLines: rc.nextLines.slice(0, countNext),
        prevLines: rc.prevLines.slice(0, countPrev),
      };
    }),
    navNodes: rawPrefab.navNodes.map(rn => {
      const { type, index: endIndex, connectionCount } = rn;
      return {
        type: type as 'physical' | 'ai',
        endIndex,
        connections: rn.connections
          .map(rc => {
            const { curveIndicesCount, targetNode: targetNavNodeIndex } = rc;
            return {
              targetNavNodeIndex,
              curveIndices: rc.curveIndices.slice(0, curveIndicesCount),
            };
          })
          .slice(0, connectionCount),
      };
    }),
    //signs: rawPrefab.signs,
    //semaphores: rawPrefab.semaphores,
  };
}

function getXYZR(
  pos: [number, number, number],
  rot: [number, number, number, number],
) {
  const [x, z, y] = pos;
  // TODO probably not the right way to do quat => euler.
  const [rx, , rz] = rot;
  // theta starts normally, but increases CW instead of CCW since game's coord system
  // has Y growing downwards.
  let rotation = Math.PI - Math.atan2(rz, rx);
  rotation = (rotation % Math.PI) * 2 - Math.PI / 2;
  return { x, y, z, rotation };
}

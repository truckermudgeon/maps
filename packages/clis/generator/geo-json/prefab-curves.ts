import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { toSplinePoints } from '@truckermudgeon/base/geom';
import { toMapPosition } from '@truckermudgeon/map/prefabs';
import type { DebugFeature } from '@truckermudgeon/map/types';
import type { GeoJSON } from 'geojson';
import type { MappedData } from '../mapped-data';
import { createNormalizeFeature } from './normalize';

export function convertToPrefabCurvesGeoJson(
  tsMapData: MappedData,
): GeoJSON.FeatureCollection {
  const { map, nodes, prefabs, prefabDescriptions } = tsMapData;
  const normalizeFeature = createNormalizeFeature(map);
  const curveFeatures: DebugFeature[] = [];

  for (const p of prefabs.values()) {
    const prefab = assertExists(prefabDescriptions.get(p.token));
    const tx = (pos: Position) => toMapPosition(pos, p, prefab, nodes);
    const lineStrings: Position[][] = [];

    for (const nn of prefab.navNodes) {
      for (const conn of nn.connections) {
        for (const curveIdx of conn.curveIndices) {
          const curve = prefab.navCurves[curveIdx];
          const points = toSplinePoints(
            {
              position: [curve.start.x, curve.start.y],
              rotation: curve.start.rotation,
            },
            {
              position: [curve.end.x, curve.end.y],
              rotation: curve.end.rotation,
            },
          );
          lineStrings.push(points.map(tx));
        }
      }
    }
    const otherCurves = prefab.navCurves.filter((_, i) => {
      const nnCis = prefab.navNodes.flatMap(nn =>
        nn.connections.flatMap(conn => conn.curveIndices),
      );
      return !nnCis.includes(i);
    });
    for (const curve of otherCurves) {
      const points = toSplinePoints(
        {
          position: [curve.start.x, curve.start.y],
          rotation: curve.start.rotation,
        },
        {
          position: [curve.end.x, curve.end.y],
          rotation: curve.end.rotation,
        },
      );
      lineStrings.push(points.map(tx));
    }

    curveFeatures.push({
      type: 'Feature',
      properties: {
        type: 'debug',
        debugType: 'lanes',
        prefabId: p.uid.toString(16),
        prefabToken: p.token,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: lineStrings,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features: curveFeatures.map(normalizeFeature),
  };
}

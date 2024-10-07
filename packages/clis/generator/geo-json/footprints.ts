import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { add, nonUniformScale, rotate } from '@truckermudgeon/base/geom';
import type {
  FootprintFeature,
  FootprintProperties,
  Model,
  ModelDescription,
  Node,
} from '@truckermudgeon/map/types';
import type { GeoJSON } from 'geojson';
import { createNormalizeFeature } from './normalize';

export function convertToFootprintsGeoJson({
  map,
  nodes,
  models,
  modelDescriptions,
}: {
  map: 'usa' | 'europe';
  nodes: Node[];
  models: Model[];
  modelDescriptions: (ModelDescription & {
    token: string;
  })[];
}): GeoJSON.FeatureCollection<GeoJSON.Polygon, FootprintProperties> {
  const nodesByUid = new Map(nodes.map(n => [n.uid, n]));
  const modelDescs = new Map(modelDescriptions.map(m => [m.token, m]));
  const normalizeCoordinates = createNormalizeFeature(map);

  return {
    type: 'FeatureCollection',
    features: models
      .map(m => {
        const node = assertExists(nodesByUid.get(m.nodeUid));
        const md = assertExists(modelDescs.get(m.token));
        const o: Position = [node.x + md.center.x, node.y + md.center.y];
        let tl: Position = add([md.start.x, md.start.y], o);
        let tr: Position = add([md.end.x, md.start.y], o);
        let br: Position = add([md.end.x, md.end.y], o);
        let bl: Position = add([md.start.x, md.end.y], o);

        [tl, tr, br, bl] = [tl, tr, br, bl].map(p =>
          nonUniformScale(
            rotate(p, node.rotation - Math.PI / 2, o),
            [m.scale.x, m.scale.y],
            o,
          ),
        );
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[tl, tr, br, bl, tl]],
          },
          properties: {
            type: 'footprint',
            height: Math.round(md.height * m.scale.z),
          },
        } as FootprintFeature;
      })
      .map(f => normalizeCoordinates(f)),
  };
}

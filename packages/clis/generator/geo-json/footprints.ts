import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { add, nonUniformScale, rotate } from '@truckermudgeon/base/geom';
import type {
  FootprintFeature,
  FootprintProperties,
} from '@truckermudgeon/map/types';
import type { GeoJSON } from 'geojson';
import type { MapDataKeys, MappedDataForKeys } from '../mapped-data';
import { createNormalizeFeature } from './normalize';

export const footprintsMapDataKeys = [
  'nodes',
  'models',
  'modelDescriptions',
] satisfies MapDataKeys;

type FootprintsMappedData = MappedDataForKeys<typeof footprintsMapDataKeys>;

export function convertToFootprintsGeoJson(
  tsMapData: FootprintsMappedData,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, FootprintProperties> {
  const { map, nodes, models, modelDescriptions } = tsMapData;
  const normalizeCoordinates = createNormalizeFeature(map);

  return {
    type: 'FeatureCollection',
    features: [...models.values()]
      .map(m => {
        const node = assertExists(nodes.get(m.nodeUid));
        const md = assertExists(modelDescriptions.get(m.token));
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

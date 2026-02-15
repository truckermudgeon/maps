import type { RouteSummary } from '../../types';
import type { GraphAndMapData, GraphMappedData } from '../lookup-data';
import type { RouteWithLookup } from './generate-routes';

export function generateSummary(
  _rwl: RouteWithLookup,
  // TODO narrow?
  _graphAndMapData: GraphAndMapData<GraphMappedData>,
): RouteSummary {
  return {
    grades: [],
    hasTolls: false,
    roads: [],
  };
}

/*

export function _generateSummary(
  rwl: RouteWithLookup,
  // TODO narrow?
  graphAndMapData: GraphAndMapData<GraphMappedData>,
): RouteSummary {
  const { tsMapData } = graphAndMapData;

  const roads: { icon: string; index: number }[] = [];
  const routeNodes = rwl.lookup.nodeUidsFlat.map(nid =>
    assertExists(tsMapData.nodes.get(nid)),
  );
  const [minX, minY, maxX, maxY] = getExtent(routeNodes);
  const potentialPois = graphAndMapData.poiRTree.search({
    minX: minX - 100,
    minY: minY - 100,
    maxX: maxX + 100,
    maxY: maxY + 100,
  });
  console.log(potentialPois.length, 'potential road pois for route');
  const routeLine = cleanCoords(
    lineString(
      rwl.segments.flatMap(segment =>
        segment.steps.flatMap(step => polyline.decode(step.geometry)),
      ),
    ),
  ) as unknown as GeoJSON.Feature<GeoJSON.LineString>;
  for (const poi of potentialPois) {
    const p = nearestPointOnLine(routeLine, poi.lngLat).properties;
    // roughly 30 meters in game units, or the width of ~7 lanes
    if (p.dist * 1000 <= 600) {
      roads.push({ icon: poi.poi.icon, index: p.location });
    }
  }

  const gradesBuilder = new GradesBuilder();
  let prevNodeUid = rwl.lookup.nodeUidsFlat[0];
  for (const curNodeUid of rwl.lookup.nodeUidsFlat.slice(1)) {
    if (prevNodeUid === curNodeUid) {
      throw new Error('repeated node: ' + prevNodeUid.toString(16));
    }
    const startNode = assertExists(tsMapData.nodes.get(prevNodeUid));
    const endNode = assertExists(tsMapData.nodes.get(curNodeUid));
    const common = getCommonItem(prevNodeUid, curNodeUid, tsMapData);
    const rise = endNode.z - startNode.z;
    let run = 0;
    switch (common.type) {
      case ItemType.Road:
        run = common.length;
        break;
      case ItemType.Prefab:
        // TODO use the length of the actual distance traveled within prefab.
        //  will need Neighbors from raw Route.
        run = distance(startNode, endNode);
        break;
      case ItemType.Company:
        break;
      default:
        throw new UnreachableError(common);
    }
    gradesBuilder.add(rise, run);
    prevNodeUid = curNodeUid;
  }

  return {
    grades: gradesBuilder.build(),
    roads: [
      ...new Set(roads.sort((a, b) => a.index - b.index).map(r => r.icon)),
    ],
    // TODO examine prefabs? rely on toll_ico pois? look for triggers?
    hasTolls: false,
  };
}

class GradesBuilder {
  private readonly riseRuns: { gradePct: number; distance: number }[] = [];

  add(rise: number, run: number) {
    const gradePct = Math.round((100 * rise) / run);
    const last = this.riseRuns.at(-1);
    if (last?.gradePct === gradePct) {
      last.distance += run;
    } else {
      this.riseRuns.push({
        gradePct,
        distance: run,
      });
    }
  }

  build(): RouteGrade[] {
    return this.riseRuns
      .filter(rr => rr.gradePct >= 5 && rr.distance >= 200)
      .map(rr => ({
        distance: rr.distance,
        percentage: rr.gradePct,
        flatIndexStart: 0,
        flatIndexEnd: 0,
        range: 0,
      }));
  }
}

*/

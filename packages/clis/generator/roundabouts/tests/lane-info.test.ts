import { readGraphData, readMapData } from '@truckermudgeon/io';
import path from 'path';
import url from 'url';
import { beforeAll } from 'vitest';
import { computeDegrees, convertToAdjacencyList } from '../graph';
import type { LaneInfoContext } from '../lane-info';
import { calculateLaneInfo } from '../lane-info';

describe('calculateLaneInfo', () => {
  let context: LaneInfoContext;
  beforeAll(() => {
    const map = 'europe';
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.join(__dirname, '../../../../../out');
    const graphData = readGraphData(outDir, map);
    const tsMapData = readMapData(outDir + '/parser', map, {
      mapDataKeys: ['nodes'],
    });
    const adjacencyList = convertToAdjacencyList(graphData.graph);
    const degrees = computeDegrees(adjacencyList);

    context = {
      tsMapData,
      adjacencyList,
      degrees,
    };
  });

  it('calculates lane info', () => {
    const cycle = [
      '4809608986306219074-forward',
      '4809608987187022910-forward',
      '4809608988483062847-forward',
      '4809608987489012800-forward',
      '4809608990211116104-forward',
      '4809608990274030665-forward',
      '4809608988973796454-forward',
      '4809608986494962812-forward',
      '4809608988256570484-forward',
      '4809608988684389486-forward',
      '4809608987388349538-forward',
      '4809608986306219074-forward',
    ];

    calculateLaneInfo(cycle, context);
  });
});

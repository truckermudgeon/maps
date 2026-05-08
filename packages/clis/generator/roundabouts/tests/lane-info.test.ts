import { readGraphData, readMapData } from '@truckermudgeon/io';
import path from 'path';
import url from 'url';
import { beforeAll } from 'vitest';
import { computeDegrees, convertToAdjacencyList } from '../graph';
import type { LaneInfoContext } from '../lane-info';
import { calculateLaneInfo } from '../lane-info';

describe.skip('calculateLaneInfo', () => {
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

    const res = calculateLaneInfo(cycle, context);
    expect(res).toMatchInlineSnapshot(`
      {
        "cycleNodeUids": [
          4809608986306219074n,
          4809608987187022910n,
          4809608988483062847n,
          4809608987489012800n,
          4809608990211116104n,
          4809608990274030665n,
          4809608988973796454n,
          4809608986494962812n,
          4809608988256570484n,
          4809608988684389486n,
          4809608987388349538n,
        ],
        "paths": Map {
          4809608988583726110n => Map {
            4809608989888154689n => {
              "angle": 1.5989700206080562,
              "exitIndex": 0,
              "numInnerNodes": 1,
              "rotateStartIndex": 2,
            },
            4809608989015739525n => {
              "angle": -1.49561364997707,
              "exitIndex": 1,
              "numInnerNodes": 6,
              "rotateStartIndex": 2,
            },
            4809608989808462944n => {
              "angle": -2.9225493807146856,
              "exitIndex": 2,
              "numInnerNodes": 9,
              "rotateStartIndex": 2,
            },
          },
          4809608989917514826n => Map {
            4809608989015739525n => {
              "angle": -0.08606817254725918,
              "exitIndex": 0,
              "numInnerNodes": 3,
              "rotateStartIndex": 5,
            },
            4809608989808462944n => {
              "angle": -1.5130039032848739,
              "exitIndex": 1,
              "numInnerNodes": 6,
              "rotateStartIndex": 5,
            },
            4809608989888154689n => {
              "angle": -3.27466980914172,
              "exitIndex": 2,
              "numInnerNodes": 9,
              "rotateStartIndex": 5,
            },
          },
          4809608986717260911n => Map {
            4809608989808462944n => {
              "angle": 1.6003565977347938,
              "exitIndex": 0,
              "numInnerNodes": 1,
              "rotateStartIndex": 10,
            },
            4809608989888154689n => {
              "angle": -0.16130930812205246,
              "exitIndex": 1,
              "numInnerNodes": 4,
              "rotateStartIndex": 10,
            },
            4809608989015739525n => {
              "angle": -3.2558929787071778,
              "exitIndex": 2,
              "numInnerNodes": 9,
              "rotateStartIndex": 10,
            },
          },
        },
      }
    `);
  });
});

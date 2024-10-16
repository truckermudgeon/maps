import { calculateNodeConnections } from '../prefabs';
import {
  prefab_2k031,
  prefab_2o09g,
  prefab_2o0ds,
  prefab_mt_2o004,
} from './fixtures';

describe('calculateNodeConnections', () => {
  it('handles roundabouts', () => {
    expect(calculateNodeConnections(prefab_2k031)).toEqual(
      new Map([
        [0, [2, 0, 1]],
        [1, [0, 1, 2]],
        [2, [2, 0, 1]],
      ]),
    );

    expect(calculateNodeConnections(prefab_mt_2o004)).toEqual(
      new Map([
        [0, [0, 1, 2, 3, 4]],
        [2, [1, 2, 3, 4, 0]],
        [3, [2, 3, 4, 0, 1]],
        [4, [3, 4, 0, 1, 2]],
        [5, [4, 0, 1, 2, 3]],
      ]),
    );
  });

  it('handles non-roundabouts', () => {
    expect(calculateNodeConnections(prefab_2o0ds)).toEqual(
      new Map([
        [0, [2, 1]],
        [1, [2]],
        [2, [1, 0]],
      ]),
    );

    expect(calculateNodeConnections(prefab_2o09g)).toEqual(
      new Map([
        [0, [2]],
        [1, [2]],
      ]),
    );
  });
});

import { bboxesToCornerPairs, bboxToCornerPair } from '../route-bounds';

describe('bboxToCornerPair', () => {
  it.each([
    {
      name: 'positive coords',
      b: [1, 2, 3, 4] as const,
      expected: [
        [1, 2],
        [3, 4],
      ],
    },
    {
      name: 'mixed signs',
      b: [-10, -5, 10, 5] as const,
      expected: [
        [-10, -5],
        [10, 5],
      ],
    },
    {
      name: 'degenerate (single point)',
      b: [3, 4, 3, 4] as const,
      expected: [
        [3, 4],
        [3, 4],
      ],
    },
  ])('extracts corner pair: $name', ({ b, expected }) => {
    expect(bboxToCornerPair(b)).toEqual(expected);
  });
});

describe('bboxesToCornerPairs', () => {
  it('returns [] for empty input', () => {
    expect(bboxesToCornerPairs([])).toEqual([]);
  });

  it('returns 2 corner points for single bbox', () => {
    expect(bboxesToCornerPairs([[1, 2, 3, 4]])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('flattens corner pairs for multiple bboxes', () => {
    expect(
      bboxesToCornerPairs([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
  });
});

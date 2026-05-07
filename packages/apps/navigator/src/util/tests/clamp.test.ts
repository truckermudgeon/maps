import { describe, expect, it } from 'vitest';
import { clamp } from '../clamp';

describe('clamp', () => {
  it.each([
    { v: 5, lo: 0, hi: 10, expected: 5 },
    { v: -1, lo: 0, hi: 10, expected: 0 },
    { v: 11, lo: 0, hi: 10, expected: 10 },
    { v: 0, lo: 0, hi: 10, expected: 0 },
    { v: 10, lo: 0, hi: 10, expected: 10 },
    { v: 5, lo: 5, hi: 5, expected: 5 },
    { v: -100, lo: -50, hi: -10, expected: -50 },
    { v: 0, lo: -50, hi: -10, expected: -10 },
  ])('clamp($v, $lo, $hi) === $expected', ({ v, lo, hi, expected }) => {
    expect(clamp(v, lo, hi)).toBe(expected);
  });
});

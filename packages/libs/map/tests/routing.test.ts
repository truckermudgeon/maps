import { isRouteKey } from '../routing';

describe('isRouteKey', () => {
  it('returns true for valid route keys', () => {
    expect(
      isRouteKey('57457ae23e11a7f4-5f76e2647d050b31-forward-fastest-usa'),
    ).toBe(true);
  });

  it('returns false for invalid route keys', () => {
    expect(isRouteKey('')).toBe(false);
    expect(
      isRouteKey('57457ae23e11a7f4-5f76e2647d050b31-forward-fastest'),
    ).toBe(false);
    expect(isRouteKey('5f76e2647d050b31-forward-fastest-usa-blah')).toBe(false);
  });
});

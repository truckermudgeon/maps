import { vi } from 'vitest';
import { delay } from '../delay';

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([0, 1, 100, 5_000])(
    'resolves after exactly %d ms',
    async (ms: number) => {
      let resolved = false;
      const p = delay(ms).then(() => {
        resolved = true;
      });

      if (ms > 0) {
        await vi.advanceTimersByTimeAsync(ms - 1);
        expect(resolved).toBe(false);
      }

      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(resolved).toBe(true);
    },
  );
});

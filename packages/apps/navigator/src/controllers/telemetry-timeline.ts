import type { TelemetrySample } from '@truckermudgeon/navigation/types';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TimelineOptions {
  lookbackMs?: number; // sim-time lookback
  maxExtrapolationMs?: number; // sim-time extrapolation
  emaAlpha?: number;
}

//

export class TelemetryTimeline {
  private samples: TelemetrySample[] = [];
  private opts: Required<TimelineOptions>;

  // sim-time cursor (what the viewer wants to see)
  private cursorSimT: number | undefined = undefined;

  // wall-time bookkeeping
  private lastWallMs: number | undefined = undefined;

  private smoothed?: TelemetrySample;

  constructor(opts: TimelineOptions = {}) {
    this.opts = {
      lookbackMs: opts.lookbackMs ?? 200,
      maxExtrapolationMs: opts.maxExtrapolationMs ?? 250,
      emaAlpha: opts.emaAlpha ?? 0,
    };
  }

  push(sample: TelemetrySample): void {
    const last = this.samples.at(-1);
    if (last && sample.t < last.t) {
      throw new Error('Simulation time must be monotonic');
    }

    this.samples.push(sample);
    this.evictOldSamples(sample.t);

    // Initialize cursor on first sample
    this.cursorSimT ??= sample.t - this.opts.lookbackMs;
  }

  /** Sample for rendering at wall-clock time */
  sample(wallMs: number): TelemetrySample | undefined {
    if (this.samples.length === 0) {
      return undefined;
    }

    const latest = this.samples[this.samples.length - 1];

    // Advance sim cursor only if not paused
    if (this.lastWallMs != null && !latest.paused) {
      const wallDt = wallMs - this.lastWallMs;
      this.cursorSimT! += wallDt;
    }

    this.lastWallMs = wallMs;

    // Clamp cursor
    const maxSimT = latest.t + this.opts.maxExtrapolationMs;
    this.cursorSimT = clamp(this.cursorSimT!, this.samples[0].t, maxSimT);

    const raw = this.sampleAtSimTime(this.cursorSimT);
    if (!raw) {
      return undefined;
    }

    if (this.opts.emaAlpha > 0) {
      this.smoothed = this.smoothed
        ? emaSample(this.smoothed, raw, this.opts.emaAlpha)
        : raw;
      return this.smoothed;
    } else {
      return raw;
    }
  }

  private evictOldSamples(latestSimT: number) {
    const cutoff =
      latestSimT - (this.opts.lookbackMs + this.opts.maxExtrapolationMs + 100);

    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  private sampleAtSimTime(simT: number): TelemetrySample | undefined {
    const n = this.samples.length;
    if (n === 0) {
      return undefined;
    }

    if (simT <= this.samples[0].t) {
      return this.samples[0];
    }

    const last = this.samples[n - 1];
    if (simT >= last.t) {
      return extrapolate(last, simT - last.t);
    }

    // binary search
    let lo = 0;
    let hi = n - 1;

    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.samples[mid].t <= simT) lo = mid;
      else hi = mid;
    }

    const a = this.samples[lo];
    const b = this.samples[hi];

    // paused or frozen sim-time; hold
    if (a.paused || b.paused || a.t === b.t) {
      // TODO should it return `b` if b.paused?
      return a;
    }

    const u = (simT - a.t) / (b.t - a.t);
    return interpolate(a, b, u);
  }
}

//

function interpolate(
  a: TelemetrySample,
  b: TelemetrySample,
  u: number,
): TelemetrySample {
  console.log('interpolate', u);
  return {
    t: lerp(a.t, b.t, u),
    paused: false,
    position: lerpVec(a.position, b.position, u),
    heading: lerpAngle(a.heading, b.heading, u),
    speed: lerp(a.speed, b.speed, u),
    linearAccel: lerpVec(a.linearAccel, b.linearAccel, u),
    angularVelocity: lerpVec(a.angularVelocity, b.angularVelocity, u),
    angularAccel: lerpVec(a.angularAccel, b.angularAccel, u),
  };
}

function extrapolate(s: TelemetrySample, dtMs: number): TelemetrySample {
  if (s.paused) {
    return s;
  }

  const dt = dtMs / 1000;
  console.log('extrapolate', dtMs);

  return {
    t: s.t + dtMs,
    paused: false,
    position: {
      x: s.position.x + Math.sin(s.heading * 2 * Math.PI) * s.speed * dt,
      y: s.position.y - Math.cos(s.heading * 2 * Math.PI) * s.speed * dt,
      z: s.position.z,
    },
    heading: s.heading + s.angularVelocity.z * dt,
    speed: s.speed,
    linearAccel: s.linearAccel,
    angularVelocity: s.angularVelocity,
    angularAccel: s.angularAccel,
  };
}

//

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function lerpVec(a: Vec3, b: Vec3, u: number): Vec3 {
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    z: lerp(a.z, b.z, u),
  };
}

export function lerpAngle(a: number, b: number, u: number): number {
  // Normalize inputs just in case
  a = ((a % 1) + 1) % 1;
  b = ((b % 1) + 1) % 1;

  let delta = b - a;

  // Wrap delta into [-0.5, 0.5]
  if (delta > 0.5) {
    delta -= 1;
  }
  if (delta < -0.5) {
    delta += 1;
  }

  const result = a + delta * u;

  // Wrap result into [0, 1)
  return (result + 1) % 1;
}

//

function emaSample(
  prev: TelemetrySample,
  next: TelemetrySample,
  alpha: number,
): TelemetrySample {
  return {
    ...next,
    position: lerpVec(prev.position, next.position, alpha),
    heading: lerpAngle(prev.heading, next.heading, alpha),
    speed: lerp(prev.speed, next.speed, alpha),
  };
}

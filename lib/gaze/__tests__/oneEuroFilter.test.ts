import { describe, it, expect } from 'vitest';
import { OneEuroFilter, OneEuroFilter2D } from '../oneEuroFilter';

// Deterministic PRNG so the noise is identical every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box–Muller
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function variance(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
}

describe('OneEuroFilter', () => {
  it('returns the first sample verbatim and tracks afterward', () => {
    const f = new OneEuroFilter();
    expect(f.initialized).toBe(false);
    expect(f.filter(42, 0)).toBe(42);
    expect(f.initialized).toBe(true);
  });

  it('reduces white-noise variance ≥60% while keeping trend latency <100ms', () => {
    // Noisy ramp. A fast-enough slope makes the speed-adaptive cutoff rise so
    // steady-state lag (≈ 1/(2π·cutoff)) drops below 100 ms.
    const fps = 100; // fine time resolution for latency measurement
    const dt = 1 / fps;
    const duration = 1.5;
    const n = Math.round(duration * fps);
    const slope = 120; // units per second
    const sigma = 8;
    const rng = mulberry32(12345);

    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 });

    const cleanResidual: number[] = []; // (noisy - clean)  → raw noise
    const filteredResidual: number[] = []; // (filtered - clean), mean-removed by variance
    const lagSamples: number[] = [];

    // Use the last 60% as "steady state" (filter has converged on the ramp).
    const steadyStart = Math.floor(n * 0.4);

    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const clean = slope * t;
      const noisy = clean + sigma * gaussian(rng);
      const out = f.filter(noisy, t);
      if (i >= steadyStart) {
        cleanResidual.push(noisy - clean);
        filteredResidual.push(out - clean);
        // On a ramp, filtered(t) ≈ clean(t - lag) ⇒ lag = (clean - filtered)/slope
        lagSamples.push((clean - out) / slope);
      }
    }

    const varNoise = variance(cleanResidual);
    const varFiltered = variance(filteredResidual);
    const reduction = 1 - varFiltered / varNoise;
    expect(reduction).toBeGreaterThanOrEqual(0.6);

    const meanLagSec = lagSamples.reduce((s, x) => s + x, 0) / lagSamples.length;
    expect(meanLagSec).toBeGreaterThan(0); // it does lag (causal filter)
    expect(meanLagSec).toBeLessThan(0.1); // but under 100 ms
  });

  it('reset() clears state so the next sample is returned without a jump', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 10; i++) f.filter(100, i * 0.01);
    f.reset();
    expect(f.initialized).toBe(false);
    expect(f.filter(0, 1)).toBe(0); // no snap from the old value of 100
  });

  it('2D composition filters axes independently', () => {
    const f = new OneEuroFilter2D();
    const first = f.filter(10, 20, 0);
    expect(first).toEqual({ x: 10, y: 20 });
    const second = f.filter(12, 22, 1 / 15);
    expect(second.x).toBeGreaterThan(10);
    expect(second.x).toBeLessThan(12);
    expect(second.y).toBeGreaterThan(20);
    expect(second.y).toBeLessThan(22);
  });
});

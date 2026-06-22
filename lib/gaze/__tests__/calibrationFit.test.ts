import { describe, it, expect } from 'vitest';
import { buildDesignRow, fitGazeModel, solveNormalEquations } from '../calibrationFit';
import type { CalibrationSample } from '../types';

// Known "ground-truth" coefficients for each axis (8 terms, pose enabled).
// Column order: [1, fx, fy, yaw, pitch, fx², fy², fx·fy]
const TRUE_X = [50, 90, 4, 0.6, 0.2, 12, -3, 5];
const TRUE_Y = [50, 6, 85, 0.1, 0.7, -2, 10, -4];

// 3×3 feature grid plus pose values chosen to be linearly independent of the
// feature columns (so the pose coefficients are identifiable).
const FX = [-0.3, 0, 0.3];
const FY = [-0.25, 0, 0.25];
const YAW = [2, -3, 5, -1, 4, -6, 3, -2, 1];
const PITCH = [1, 4, -2, 5, -3, 2, -4, 6, 0];

function evalAxis(coeffs: number[], fx: number, fy: number, yaw: number, pitch: number): number {
  const row = buildDesignRow(fx, fy, yaw, pitch, true);
  return coeffs.reduce((s, c, i) => s + c * row[i]!, 0);
}

function buildSamples(): CalibrationSample[] {
  const samples: CalibrationSample[] = [];
  let k = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const fx = FX[c]!;
      const fy = FY[r]!;
      const yaw = YAW[k]!;
      const pitch = PITCH[k]!;
      const x = evalAxis(TRUE_X, fx, fy, yaw, pitch);
      const y = evalAxis(TRUE_Y, fx, fy, yaw, pitch);
      samples.push({ fx, fy, yaw, pitch, target: { x, y } });
      k++;
    }
  }
  return samples;
}

describe('calibrationFit', () => {
  it('solveNormalEquations recovers a simple linear system', () => {
    // y = 3 + 2*a for rows [1, a]
    const A = [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const b = [3, 5, 7, 9];
    const coeffs = solveNormalEquations(A, b)!;
    expect(coeffs[0]!).toBeCloseTo(3, 4);
    expect(coeffs[1]!).toBeCloseTo(2, 4);
  });

  it('recovers the quadratic + pose coefficients on each axis to <1%', () => {
    const samples = buildSamples();
    const model = fitGazeModel(samples)!;
    expect(model).toBeTruthy();
    expect(model.hasPose).toBe(true);

    const checkAxis = (recovered: readonly number[], truth: number[]) => {
      for (let i = 0; i < truth.length; i++) {
        const rel = Math.abs(recovered[i]! - truth[i]!) / Math.max(1e-6, Math.abs(truth[i]!));
        expect(rel).toBeLessThan(0.01);
      }
    };
    checkAxis(model.coeffsX, TRUE_X);
    checkAxis(model.coeffsY, TRUE_Y);
  });

  it('reports good quality + monotonic axes for clean synthetic data', () => {
    const model = fitGazeModel(buildSamples())!;
    expect(model.cvErrorFraction).toBeLessThan(0.03);
    expect(model.quality).toBe('good');
    expect(model.xMonotonic).toBe(true);
    expect(model.yMonotonic).toBe(true);
  });

  it('predict() round-trips a calibration point back to its target', () => {
    const samples = buildSamples();
    const model = fitGazeModel(samples)!;
    const s = samples[4]!; // centre
    const p = model.predict({ fx: s.fx, fy: s.fy }, { yaw: s.yaw, pitch: s.pitch });
    expect(p.x).toBeCloseTo(s.target.x, 2);
    expect(p.y).toBeCloseTo(s.target.y, 2);
  });

  it('returns null with too few points', () => {
    expect(fitGazeModel(buildSamples().slice(0, 4))).toBeNull();
  });
});

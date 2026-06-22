/**
 * calibrationFit — second-order bivariate polynomial gaze→screen mapping with
 * head-pose terms, fitted by least squares (normal equations).
 *
 * Reference: Morimoto & Mimica (2005). "Eye gaze tracking techniques for
 * interactive applications." CVIU 98(1). The original polynomial assumes a
 * fixed head; here it is extended with LINEAR pose terms (yaw, pitch) so the
 * mapping stays valid for webcam tracking without head fixation.
 *
 *   screen_x = a0 + a1·fx + a2·fy + a3·yaw + a4·pitch + a5·fx² + a6·fy² + a7·fx·fy
 *   screen_y = b0 + b1·fx + b2·fy + b3·yaw + b4·pitch + b5·fx² + b6·fy² + b7·fx·fy
 *
 * Two independent fits (one per axis). With 9 calibration points and 8 unknowns
 * the system is overdetermined → least squares. Without pose data we drop the
 * two pose terms (6 unknowns). Solved by Gauss-Jordan on the 8×8 (or 6×6)
 * normal-equations matrix — stable and trivial at this size; no external libs.
 *
 * Quality is judged by LEAVE-ONE-OUT cross-validation, never by the training
 * residual: the polynomial minimizes the training residual by construction, so
 * it is always small even for a bad model. LOO predicts each held-out point
 * from the other 8 and reports the mean error in screen-% units.
 */

import type {
  AxisCoefficients,
  CalibrationModel,
  CalibrationQuality,
  CalibrationSample,
  Point2D,
} from './types';

/** Diagonal of the [0,100]² screen-% space, used to normalize the CV error. */
export const SCREEN_DIAGONAL_PCT = Math.hypot(100, 100); // ≈ 141.42

/** CV-error bands as a fraction of the screen diagonal (Phase 1 spec). */
export const CV_GOOD_FRACTION = 0.03; // < 3%  → good
export const CV_POOR_FRACTION = 0.06; // > 6%  → poor (offer re-calibration)

/** Tiny Tikhonov ridge keeps the normal-equations matrix invertible under noise. */
const RIDGE = 1e-6;

/**
 * Build a design-matrix row. With pose: 8 terms; without: 6 terms (pose
 * columns omitted). The column order is fixed and shared by fit and predict.
 */
export function buildDesignRow(fx: number, fy: number, yaw: number, pitch: number, hasPose: boolean): number[] {
  if (hasPose) {
    return [1, fx, fy, yaw, pitch, fx * fx, fy * fy, fx * fy];
  }
  return [1, fx, fy, fx * fx, fy * fy, fx * fy];
}

/**
 * Solve the normal equations AᵀA·x = Aᵀb by Gauss-Jordan elimination with
 * partial pivoting. Returns coefficients, or null if singular.
 */
export function solveNormalEquations(A: ReadonlyArray<ReadonlyArray<number>>, b: ReadonlyArray<number>): number[] | null {
  const m = A.length;
  if (m === 0) return null;
  const n = A[0]!.length;

  // AᵀA (n×n) and Aᵀb (n)
  const AtA: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const Atb: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += A[k]![i]! * A[k]![j]!;
      AtA[i]![j] = s;
    }
    let s = 0;
    for (let k = 0; k < m; k++) s += A[k]![i]! * b[k]!;
    Atb[i] = s;
    AtA[i]![i]! += RIDGE;
  }

  // Augmented [AtA | Atb], Gauss-Jordan with partial pivoting.
  const aug: number[][] = AtA.map((row, i) => [...row, Atb[i]!]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k]![i]!) > Math.abs(aug[maxRow]![i]!)) maxRow = k;
    }
    const tmp = aug[i]!;
    aug[i] = aug[maxRow]!;
    aug[maxRow] = tmp;

    const pivot = aug[i]![i]!;
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = i; j <= n; j++) aug[i]![j]! /= pivot;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k]![i]!;
      for (let j = i; j <= n; j++) aug[k]![j]! -= factor * aug[i]![j]!;
    }
  }
  return aug.map((row) => row[n]!);
}

function evalRow(coeffs: AxisCoefficients, row: ReadonlyArray<number>): number {
  let v = 0;
  for (let i = 0; i < coeffs.length; i++) v += coeffs[i]! * row[i]!;
  return v;
}

/** Sign of covariance between two series (for monotonicity sanity checks). */
function covariance(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  const n = a.length;
  if (n === 0) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i]!;
    mb += b[i]!;
  }
  ma /= n;
  mb /= n;
  let c = 0;
  for (let i = 0; i < n; i++) c += (a[i]! - ma) * (b[i]! - mb);
  return c / n;
}

export interface FitOptions {
  /** Force-disable pose terms even if samples carry pose (default: auto). */
  compensateHead?: boolean;
}

/**
 * Fit the gaze→screen model from calibration samples (≥ 6, ideally 9) and
 * compute leave-one-out CV quality.
 */
export function fitGazeModel(samples: ReadonlyArray<CalibrationSample>, options: FitOptions = {}): CalibrationModel | null {
  const minPoints = 6;
  if (samples.length < minPoints) return null;

  // Use pose terms when every sample carries finite pose, unless explicitly
  // disabled via compensateHead:false.
  const poseAvailable = samples.every((s) => Number.isFinite(s.yaw) && Number.isFinite(s.pitch));
  const hasPose = poseAvailable && options.compensateHead !== false;

  const rows = samples.map((s) => buildDesignRow(s.fx, s.fy, s.yaw, s.pitch, hasPose));
  const bx = samples.map((s) => s.target.x);
  const by = samples.map((s) => s.target.y);

  const coeffsX = solveNormalEquations(rows, bx);
  const coeffsY = solveNormalEquations(rows, by);
  if (!coeffsX || !coeffsY) return null;

  // ── Leave-one-out cross-validation ─────────────────────────────────────────
  let cvSum = 0;
  let cvCount = 0;
  const predXs: number[] = [];
  const predYs: number[] = [];
  for (let held = 0; held < samples.length; held++) {
    const trainRows: number[][] = [];
    const trainBx: number[] = [];
    const trainBy: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      if (i === held) continue;
      trainRows.push(rows[i]!);
      trainBx.push(bx[i]!);
      trainBy.push(by[i]!);
    }
    const cx = solveNormalEquations(trainRows, trainBx);
    const cy = solveNormalEquations(trainRows, trainBy);
    if (!cx || !cy) continue;
    const px = evalRow(cx, rows[held]!);
    const py = evalRow(cy, rows[held]!);
    predXs.push(px);
    predYs.push(py);
    cvSum += Math.hypot(px - bx[held]!, py - by[held]!);
    cvCount += 1;
  }
  const meanCVError = cvCount ? cvSum / cvCount : Number.POSITIVE_INFINITY;
  const cvErrorFraction = meanCVError / SCREEN_DIAGONAL_PCT;

  let quality: CalibrationQuality;
  if (cvErrorFraction < CV_GOOD_FRACTION) quality = 'good';
  else if (cvErrorFraction <= CV_POOR_FRACTION) quality = 'acceptable';
  else quality = 'poor';

  // Monotonicity sanity: predicted axis should rise with its target axis.
  const xMonotonic = covariance(bx, samples.map((s) => evalRow(coeffsX, buildDesignRow(s.fx, s.fy, s.yaw, s.pitch, hasPose)))) > 0;
  const yMonotonic = covariance(by, samples.map((s) => evalRow(coeffsY, buildDesignRow(s.fx, s.fy, s.yaw, s.pitch, hasPose)))) > 0;

  const predict = (features: { fx: number; fy: number }, pose?: { yaw?: number; pitch?: number }): Point2D => {
    const row = buildDesignRow(features.fx, features.fy, pose?.yaw ?? 0, pose?.pitch ?? 0, hasPose);
    return { x: evalRow(coeffsX, row), y: evalRow(coeffsY, row) };
  };

  return {
    predict,
    coeffsX,
    coeffsY,
    hasPose,
    meanCVError,
    cvErrorFraction,
    quality,
    xMonotonic,
    yMonotonic,
  };
}

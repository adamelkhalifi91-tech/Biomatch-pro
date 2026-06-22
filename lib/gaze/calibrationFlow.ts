/**
 * calibrationFlow — orchestrates the 9-point collection state machine.
 *
 * Per Phase 1 spec:
 *  - 9-point 3×3 grid (the component places the dots; this tracks the data).
 *  - Per point, collect samples during a ~1 s fixation, discard the first 20%
 *    (fixation transient), aggregate the rest with the MEDIAN (robust to the
 *    occasional partial blink / outlier the upstream gate let through).
 *  - If fewer than MIN_VALID_SAMPLES survive, auto-retry the point. If it fails
 *    repeatedly, mark the whole calibration poor and force a full restart.
 *
 * The caller is responsible for only calling `addSample` with frames that have
 * already passed the quality gate and are NOT blinks — blink/bad frames must
 * not advance this collector (they "don't move the clock").
 */

import type { CalibrationSample, Point2D } from './types';

/**
 * Minimum valid samples per point after transient + blink removal. 12 gives the
 * median a stable basis; below it the point is too sparse to trust.
 */
export const MIN_VALID_SAMPLES = 12;

/** Fraction of the head of each point's buffer discarded as fixation transient. */
export const TRANSIENT_FRACTION = 0.2;

/** Per-point auto-retries before the whole calibration is declared poor. */
export const MAX_POINT_RETRIES = 3;

export interface RawCalibrationSample {
  readonly fx: number;
  readonly fy: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly ts: number;
}

function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Aggregate a point's raw buffer: drop the leading transient, then take the
 * median of each channel. Returns null if too few samples survive.
 */
export function aggregatePoint(
  buffer: ReadonlyArray<RawCalibrationSample>,
  target: Point2D,
  transientFraction: number = TRANSIENT_FRACTION,
  minValid: number = MIN_VALID_SAMPLES,
): CalibrationSample | null {
  const drop = Math.floor(buffer.length * transientFraction);
  const kept = buffer.slice(drop);
  if (kept.length < minValid) return null;
  return {
    fx: median(kept.map((s) => s.fx)),
    fy: median(kept.map((s) => s.fy)),
    yaw: median(kept.map((s) => s.yaw)),
    pitch: median(kept.map((s) => s.pitch)),
    target,
  };
}

export type FinalizeResult =
  | { readonly status: 'accepted'; readonly index: number; readonly sample: CalibrationSample }
  | { readonly status: 'complete'; readonly samples: ReadonlyArray<CalibrationSample> }
  | { readonly status: 'retry'; readonly index: number; readonly retries: number }
  | { readonly status: 'failed' };

export class CalibrationCollector {
  private readonly points: ReadonlyArray<Point2D>;
  private readonly minValid: number;
  private readonly transientFraction: number;
  private readonly maxRetries: number;
  private index = 0;
  private retries = 0;
  private buffer: RawCalibrationSample[] = [];
  private readonly results: CalibrationSample[] = [];

  constructor(
    points: ReadonlyArray<Point2D>,
    opts: { minValid?: number; transientFraction?: number; maxRetries?: number } = {},
  ) {
    this.points = points;
    this.minValid = opts.minValid ?? MIN_VALID_SAMPLES;
    this.transientFraction = opts.transientFraction ?? TRANSIENT_FRACTION;
    this.maxRetries = opts.maxRetries ?? MAX_POINT_RETRIES;
  }

  /** Push a quality-gated, non-blink sample into the current point's buffer. */
  addSample(s: RawCalibrationSample): void {
    this.buffer.push(s);
  }

  get currentIndex(): number {
    return this.index;
  }

  get currentTarget(): Point2D | null {
    return this.points[this.index] ?? null;
  }

  get sampleCount(): number {
    return this.buffer.length;
  }

  get totalPoints(): number {
    return this.points.length;
  }

  /**
   * Close the current point's collection window and evaluate it. Advances to the
   * next point on success; on the final point returns the full sample set.
   */
  finalizePoint(): FinalizeResult {
    const target = this.points[this.index]!;
    const sample = aggregatePoint(this.buffer, target, this.transientFraction, this.minValid);

    if (!sample) {
      this.retries += 1;
      this.buffer = [];
      if (this.retries > this.maxRetries) {
        return { status: 'failed' };
      }
      return { status: 'retry', index: this.index, retries: this.retries };
    }

    this.results.push(sample);
    this.buffer = [];
    this.retries = 0;
    const accepted = sample;

    if (this.index >= this.points.length - 1) {
      return { status: 'complete', samples: this.results.slice() };
    }
    this.index += 1;
    return { status: 'accepted', index: this.index - 1, sample: accepted };
  }

  reset(): void {
    this.index = 0;
    this.retries = 0;
    this.buffer = [];
    this.results.length = 0;
  }
}

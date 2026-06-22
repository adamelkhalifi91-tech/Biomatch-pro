/**
 * gazeRuntime — ties the per-frame pipeline together and exposes a smoothed
 * dot target for a decoupled 60 FPS render loop.
 *
 * Detector loop (this module) runs at DETECTOR_FPS; the render loop (GazeDot)
 * runs at 60 FPS and eases toward `dotTarget`. This is what makes a 15 FPS
 * detector feel fluid and hides dropped frames.
 *
 * Ordering inside ingest(): quality gate → blink → feature extraction →
 * polynomial predict → 2D One Euro filter on the SCREEN-space output. Blink and
 * quality-rejected frames neither feed the filter nor move the dot.
 */

import { BlinkDetector, computeEyeAspectRatios } from './blinkDetector';
import { fitGazeModel } from './calibrationFit';
import { estimateHeadPose, extractGazeFeatures } from './gazeMapper';
import { OneEuroFilter2D, type OneEuroParams } from './oneEuroFilter';
import { evaluateFrameQuality, QualityTracker } from './qualityGate';
import type {
  CalibrationSample,
  HeadPose,
  Landmarks,
  Point2D,
  SignalQuality,
} from './types';

/**
 * Detector sampling rate. Previous code ran at 4 FPS, which is the root cause of
 * the "punto que vibra y salta": each frame mapped independently with no
 * temporal coherence. 15 FPS is the spec's documented safe tier — a real CPU
 * profile on the target laptop could not be captured in this headless build
 * environment, so the conservative fallback is chosen over a fabricated number.
 * Raise to 30 only after profiling shows the page stays < 60% sustained CPU.
 */
export const DETECTOR_FPS = 15;
export const DETECTOR_INTERVAL_MS = 1000 / DETECTOR_FPS;

/**
 * Render-loop easing factor (exponential smoothing toward the filtered target),
 * applied once per 60 FPS frame. 0.30 reaches ~95% of a step in ~5 frames
 * (~83 ms) — fluid without feeling detached from the eyes.
 */
export const RENDER_EASING = 0.3;

/** Default One Euro params for the screen-space dot (Casiez 2012 starting set). */
export const DEFAULT_FILTER_PARAMS: OneEuroParams = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };

/** Personal, range-derived integrity thresholds in the NEW feature space. */
export interface PersonalThresholds {
  readonly gaze_lateral: number;
  readonly gaze_up: number;
  readonly gaze_down: number;
  readonly center_h: number;
  readonly center_v: number;
}

/** Runtime model = polynomial fit + personal thresholds + quality metadata. */
export interface RuntimeGazeModel {
  /** Raw polynomial screen-% prediction (pre-filter). */
  predictScreen(features: { fx: number; fy: number }, pose?: { yaw?: number; pitch?: number }): Point2D;
  readonly thresholds: PersonalThresholds;
  readonly confidence: number;
  readonly quality: 'good' | 'acceptable' | 'poor';
  readonly meanCVError: number;
  readonly cvErrorFraction: number;
  readonly hasPose: boolean;
  readonly xMonotonic: boolean;
  readonly yMonotonic: boolean;
}

function median(values: ReadonlyArray<number>): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Build the runtime model from calibration samples: fit the polynomial, then
 * derive self-scaling personal thresholds from the measured feature range.
 *
 * Thresholds are expressed as fractions of the measured calibration range so
 * they adapt to each person's iris-displacement scale instead of relying on
 * absolute constants tuned for a different feature definition. A lateral glance
 * counts when the centred feature exceeds 30% of the half-range to each side.
 */
export function buildRuntimeModel(
  samples: ReadonlyArray<CalibrationSample>,
  opts: { compensateHead?: boolean } = {},
): RuntimeGazeModel | null {
  const model = fitGazeModel(samples, opts);
  if (!model) return null;

  const fxs = samples.map((s) => s.fx);
  const fys = samples.map((s) => s.fy);
  const centerH = median(fxs);
  const centerV = median(fys);
  const rangeH = Math.max(...fxs) - Math.min(...fxs) || 1e-3;
  const rangeV = Math.max(...fys) - Math.min(...fys) || 1e-3;

  const thresholds: PersonalThresholds = {
    // 30% of the half-range to one side counts as a deliberate lateral glance.
    gaze_lateral: Math.max(0.02, (rangeH / 2) * 0.3),
    // Vertical is anatomically compressed (upper lid follows the iris), so up is
    // tighter and down is looser — mirrors the asymmetry the old engine used.
    gaze_up: Math.max(0.015, (rangeV / 2) * 0.25),
    gaze_down: Math.max(0.02, (rangeV / 2) * 0.35),
    center_h: centerH,
    center_v: centerV,
  };

  // Confidence: blend of CV quality (lower error ⇒ higher confidence).
  const confidence = Math.max(0.3, Math.min(0.99, 1 - model.cvErrorFraction * 4));

  return {
    predictScreen: model.predict,
    thresholds,
    confidence,
    quality: model.quality,
    meanCVError: model.meanCVError,
    cvErrorFraction: model.cvErrorFraction,
    hasPose: model.hasPose,
    xMonotonic: model.xMonotonic,
    yMonotonic: model.yMonotonic,
  };
}

/** Raw detector input for one frame. */
export interface DetectorInput {
  readonly hasFace: boolean;
  readonly faceCount: number;
  readonly landmarks?: Landmarks;
  /** Mean eye-region luminance (0–255) if sampled; null skips the light check. */
  readonly eyeLuminance?: number | null;
  /** Timestamp in ms (Date.now or performance.now); used for filter dt + loss. */
  readonly ts: number;
}

/** Enriched per-frame result emitted to consumers (back-compatible superset). */
export interface GazeFrame {
  readonly hasFace: boolean;
  readonly faceCount: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly ear: number;
  /** Raw ocular features (fx,fy) for integrity logic. null if unusable. */
  readonly gaze: { h: number; v: number } | null;
  /** Smoothed screen-% dot target for the render loop. null if no model/lost. */
  readonly dot: Point2D | null;
  readonly isBlink: boolean;
  readonly signalQuality: SignalQuality;
  /** True on the edge where tracking became lost (caller may close fixations). */
  readonly trackingLost: boolean;
  readonly eyesOpen: boolean;
}

export class GazeRuntime {
  private readonly filter: OneEuroFilter2D;
  private readonly blink: BlinkDetector;
  private readonly quality: QualityTracker;
  private model: RuntimeGazeModel | null = null;
  private dotTarget: Point2D | null = null;

  constructor(filterParams: OneEuroParams = DEFAULT_FILTER_PARAMS) {
    this.filter = new OneEuroFilter2D(filterParams);
    this.blink = new BlinkDetector();
    this.quality = new QualityTracker();
  }

  setModel(model: RuntimeGazeModel | null): void {
    this.model = model;
  }

  /** Latest smoothed dot target in screen % (read by the 60 FPS render loop). */
  getDotTarget(): Point2D | null {
    return this.dotTarget;
  }

  ingest(input: DetectorInput): GazeFrame {
    const ts = input.ts;

    if (!input.hasFace || !input.landmarks) {
      const tr = this.quality.update(
        { ok: false, quality: 'lost', reasons: ['no_face'], eyeLuminance: null, confidence: 0 },
        ts,
      );
      if (tr.enteredLost) {
        this.filter.reset();
        this.dotTarget = null;
      }
      return {
        hasFace: false,
        faceCount: input.faceCount,
        yaw: 0,
        pitch: 0,
        roll: 0,
        ear: Number.NaN,
        gaze: null,
        dot: this.dotTarget,
        isBlink: false,
        signalQuality: 'lost',
        trackingLost: tr.enteredLost,
        eyesOpen: false,
      };
    }

    const lm = input.landmarks;
    const pose: HeadPose = estimateHeadPose(lm);
    const ear = computeEyeAspectRatios(lm).mean;
    const blinkUpdate = this.blink.update(ear);

    const q = evaluateFrameQuality({
      hasFace: true,
      landmarks: lm,
      pose,
      eyeLuminance: input.eyeLuminance ?? null,
    });
    const tr = this.quality.update(q, ts);
    if (tr.enteredLost) {
      this.filter.reset();
      this.dotTarget = null;
    }

    const features = extractGazeFeatures(lm);
    const usable = q.ok && !blinkUpdate.shouldExclude && features.nEyes > 0;

    let gaze: { h: number; v: number } | null = null;
    if (features.nEyes > 0 && !blinkUpdate.shouldExclude) {
      gaze = { h: features.fx, v: features.fy };
    }

    if (usable && this.model) {
      const screen = this.model.predictScreen(
        { fx: features.fx, fy: features.fy },
        { yaw: pose.yaw, pitch: pose.pitch },
      );
      const clampedX = Math.max(0, Math.min(100, screen.x));
      const clampedY = Math.max(0, Math.min(100, screen.y));
      const filtered = this.filter.filter(clampedX, clampedY, ts / 1000);
      this.dotTarget = {
        x: Math.max(0, Math.min(100, filtered.x)),
        y: Math.max(0, Math.min(100, filtered.y)),
      };
    }
    // When not usable we intentionally hold the last dotTarget (the render loop
    // simply stops easing toward a new point) rather than snapping it away.

    return {
      hasFace: true,
      faceCount: input.faceCount,
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
      ear,
      gaze,
      dot: usable && this.model ? this.dotTarget : null,
      isBlink: blinkUpdate.isBlink,
      signalQuality: tr.quality,
      trackingLost: tr.enteredLost,
      eyesOpen: !blinkUpdate.shouldExclude && features.nEyes > 0,
    };
  }

  reset(): void {
    this.filter.reset();
    this.blink.reset();
    this.quality.reset();
    this.dotTarget = null;
  }
}

/**
 * Blink detection via Eye Aspect Ratio (EAR).
 *
 * Reference: Soukupová & Čech (2016). "Real-Time Eye Blink Detection using
 * Facial Landmarks." 21st Computer Vision Winter Workshop.
 *
 *   EAR = (|p2 - p6| + |p3 - p5|) / (2 · |p1 - p4|)
 *
 * p1..p6 are the 6 eyelid landmarks (p1/p4 = horizontal corners, the other two
 * pairs = vertical lids). During a blink the iris is partially occluded and its
 * MediaPipe landmarks slide onto the eyelid, faking a strong "looking down"
 * reading. If those samples reach the One Euro filter, the polynomial fit, or
 * the fixation logic, they silently poison all three — hence we detect and
 * exclude them here, upstream of everything else.
 */

import type { EyeAspectRatios, Landmarks } from './types';

/**
 * 6-point EAR landmark indices for MediaPipe FaceMesh.
 * Right eye (image-right side, "33/133" region) and left eye ("362/263").
 * Order is [p1, p2, p3, p4, p5, p6] = [outer, topA, topB, inner, botB, botA].
 */
const RIGHT_EYE_EAR: readonly [number, number, number, number, number, number] = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_EAR: readonly [number, number, number, number, number, number] = [362, 385, 387, 263, 373, 380];

/**
 * EAR threshold. A fully open eye sits around 0.25–0.35; a closed eye near 0.
 * 0.21 is the spec's starting value — comfortably below the open-eye range so
 * normal narrowing (squinting, smiling) doesn't trip it, while catching true
 * lid closure.
 */
export const EAR_BLINK_THRESHOLD = 0.21;

/**
 * A blink *event* is only confirmed after this many consecutive sub-threshold
 * frames. At 15 FPS, 2 frames ≈ 133 ms — short enough to catch a fast blink,
 * long enough to reject a single noisy frame as an event. (Individual
 * sub-threshold frames are still excluded from gaze regardless.)
 */
export const MIN_BLINK_FRAMES = 2;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function earForIndices(
  lm: Landmarks,
  idx: readonly [number, number, number, number, number, number],
): number {
  const p1 = lm[idx[0]];
  const p2 = lm[idx[1]];
  const p3 = lm[idx[2]];
  const p4 = lm[idx[3]];
  const p5 = lm[idx[4]];
  const p6 = lm[idx[5]];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return Number.NaN;
  const horizontal = 2 * dist(p1.x, p1.y, p4.x, p4.y);
  if (horizontal < 1e-9) return Number.NaN;
  const vertical = dist(p2.x, p2.y, p6.x, p6.y) + dist(p3.x, p3.y, p5.x, p5.y);
  return vertical / horizontal;
}

/** Compute per-eye and mean EAR from a landmark set. */
export function computeEyeAspectRatios(lm: Landmarks): EyeAspectRatios {
  const right = earForIndices(lm, RIGHT_EYE_EAR);
  const left = earForIndices(lm, LEFT_EYE_EAR);
  const valid = [left, right].filter((v) => Number.isFinite(v));
  const mean = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : Number.NaN;
  return { left, right, mean };
}

export interface BlinkUpdate {
  /** Mean EAR for this frame. */
  readonly ear: number;
  /** This frame's EAR is below threshold ⇒ exclude it from the gaze pipeline. */
  readonly shouldExclude: boolean;
  /** A blink event (≥ MIN_BLINK_FRAMES consecutive sub-threshold) is in progress. */
  readonly isBlink: boolean;
  /** Total confirmed blink events seen so far (rises once per blink). */
  readonly blinkCount: number;
}

/**
 * Stateful blink tracker. Feed one mean-EAR value per detector frame.
 *
 * `shouldExclude` is the authoritative "drop this sample" signal: ANY
 * sub-threshold frame is excluded (covers partial occlusion at blink edges),
 * while `isBlink`/`blinkCount` track confirmed events for logging.
 */
export class BlinkDetector {
  private readonly threshold: number;
  private readonly minFrames: number;
  private consecutiveBelow = 0;
  private eventCounted = false;
  private blinks = 0;

  constructor(threshold: number = EAR_BLINK_THRESHOLD, minFrames: number = MIN_BLINK_FRAMES) {
    this.threshold = threshold;
    this.minFrames = minFrames;
  }

  update(ear: number): BlinkUpdate {
    const below = Number.isFinite(ear) && ear < this.threshold;
    if (below) {
      this.consecutiveBelow += 1;
      if (this.consecutiveBelow >= this.minFrames && !this.eventCounted) {
        this.blinks += 1;
        this.eventCounted = true;
      }
    } else {
      this.consecutiveBelow = 0;
      this.eventCounted = false;
    }
    return {
      ear,
      shouldExclude: below,
      isBlink: this.consecutiveBelow >= this.minFrames,
      blinkCount: this.blinks,
    };
  }

  /** Convenience: derive mean EAR from landmarks, then update. */
  updateFromLandmarks(lm: Landmarks): BlinkUpdate {
    return this.update(computeEyeAspectRatios(lm).mean);
  }

  reset(): void {
    this.consecutiveBelow = 0;
    this.eventCounted = false;
    this.blinks = 0;
  }
}

/**
 * qualityGate — discards frames before they can poison the filter, the
 * calibration fit, or the fixation logic.
 *
 * A noisy/partial/badly-lit/extremely-posed frame contributes the same weight
 * as a clean one unless it is gated out. This module is the gate, plus a small
 * temporal tracker that turns sustained loss into a `tracking_lost` state and
 * drives the discrete `SignalQuality` reported to the UX.
 */

import type { HeadPose, Landmarks, QualityReason, QualityResult, SignalQuality } from './types';

// ── Thresholds (each with its rationale) ─────────────────────────────────────

/**
 * Beyond ±35° of yaw or pitch the iris is foreshortened/occluded enough that
 * the polynomial extrapolates badly. Normal attentive movement stays well
 * inside this; 35° is "clearly turned away," not "shifted in the chair".
 */
export const MAX_POSE_DEG = 35;

/**
 * Face-edge margin: if a border landmark sits within 5% of the webcam frame
 * edge, the face is being clipped and landmark positions on that side are
 * unreliable. 5% ≈ 36 px on a 720p frame — a real margin, not pixel-peeping.
 */
export const FRAME_EDGE_MARGIN = 0.05;

/** Eye-region mean luminance (0–255) below this ⇒ too dark for stable iris. */
export const MIN_EYE_LUMINANCE = 40;

/** Below this confidence proxy the detection is rejected outright. */
export const MIN_CONFIDENCE = 0.35;
/** Between MIN_CONFIDENCE and this, the frame is kept but flagged 'fair'. */
export const FAIR_CONFIDENCE = 0.6;

/**
 * Sustained no-valid-sample window. After 500 ms with no usable frame we close
 * open fixations (interrupted), reset the One Euro filter, and emit
 * 'tracking_lost' so the dot restarts cleanly instead of snapping.
 */
export const TRACKING_LOST_MS = 500;

// Expected ratio of inter-ocular distance (outer canthi span) to face width.
// Roughly constant across faces (~0.9 here because outer canthi span most of
// the cheek-to-cheek width). A large deviation means FaceMesh mis-fit the face.
const EXPECTED_IOD_RATIO = 0.9;
const CHEEK_LEFT = 234;
const CHEEK_RIGHT = 454;
const CANTHUS_OUTER_RIGHT = 33;
const CANTHUS_OUTER_LEFT = 263;

/** Border landmarks used for the partial-face check (temples, forehead, chin). */
const BORDER_LANDMARKS: readonly number[] = [10, 152, 234, 454, 33, 263];

export interface QualityInput {
  readonly hasFace: boolean;
  readonly landmarks?: Landmarks;
  readonly pose?: HeadPose;
  /** Mean luminance (0–255) sampled around the eyes; null ⇒ skip light check. */
  readonly eyeLuminance?: number | null;
  /** FaceMesh-reported confidence if available; null ⇒ derive a proxy. */
  readonly reportedConfidence?: number | null;
}

/** Derive a [0,1] confidence proxy from landmark geometry plausibility. */
function confidenceProxy(lm: Landmarks): number {
  const cheekL = lm[CHEEK_LEFT];
  const cheekR = lm[CHEEK_RIGHT];
  const outerR = lm[CANTHUS_OUTER_RIGHT];
  const outerL = lm[CANTHUS_OUTER_LEFT];
  if (!cheekL || !cheekR || !outerR || !outerL) return 0;
  const faceW = Math.abs(cheekR.x - cheekL.x);
  if (faceW < 1e-3) return 0;
  const iod = Math.abs(outerL.x - outerR.x);
  const ratio = iod / faceW;
  // 1 at the expected ratio, decaying linearly with relative deviation.
  const deviation = Math.abs(ratio - EXPECTED_IOD_RATIO) / EXPECTED_IOD_RATIO;
  return Math.max(0, Math.min(1, 1 - deviation));
}

function isFacePartial(lm: Landmarks): boolean {
  for (const i of BORDER_LANDMARKS) {
    const p = lm[i];
    if (!p) continue;
    if (
      p.x < FRAME_EDGE_MARGIN ||
      p.x > 1 - FRAME_EDGE_MARGIN ||
      p.y < FRAME_EDGE_MARGIN ||
      p.y > 1 - FRAME_EDGE_MARGIN
    ) {
      return true;
    }
  }
  return false;
}

/** Evaluate a single frame. Pure — no temporal state. */
export function evaluateFrameQuality(input: QualityInput): QualityResult {
  if (!input.hasFace || !input.landmarks) {
    return { ok: false, quality: 'lost', reasons: ['no_face'], eyeLuminance: null, confidence: 0 };
  }

  const lm = input.landmarks;
  const reasons: QualityReason[] = [];

  // Pose
  if (input.pose && (Math.abs(input.pose.yaw) > MAX_POSE_DEG || Math.abs(input.pose.pitch) > MAX_POSE_DEG)) {
    reasons.push('extreme_pose');
  }

  // Partial face
  if (isFacePartial(lm)) reasons.push('face_partial');

  // Confidence (reported or proxy)
  const confidence =
    input.reportedConfidence != null ? input.reportedConfidence : confidenceProxy(lm);
  if (confidence < MIN_CONFIDENCE) reasons.push('low_confidence');

  // Light
  const eyeLuminance = input.eyeLuminance ?? null;
  if (eyeLuminance != null && eyeLuminance < MIN_EYE_LUMINANCE) reasons.push('low_light');

  // Hard-fail reasons drop the frame and mark it 'poor'.
  const hardFail =
    reasons.includes('extreme_pose') ||
    reasons.includes('face_partial') ||
    reasons.includes('low_light') ||
    reasons.includes('low_confidence');

  if (hardFail) {
    return { ok: false, quality: 'poor', reasons, eyeLuminance, confidence };
  }

  // Kept frames: 'fair' if confidence is only borderline, else 'good'.
  const quality: SignalQuality = confidence < FAIR_CONFIDENCE ? 'fair' : 'good';
  return { ok: true, quality, reasons, eyeLuminance, confidence };
}

export interface QualityTransition {
  readonly quality: SignalQuality;
  /** True on the frame where we cross into sustained 'lost'. */
  readonly enteredLost: boolean;
  /** True on the first good frame after a 'lost' span (caller resets filter). */
  readonly recovered: boolean;
}

/**
 * Temporal wrapper: converts per-frame results into a stable SignalQuality and
 * fires `enteredLost` / `recovered` edges for the runtime to react to.
 */
export class QualityTracker {
  private readonly lostMs: number;
  private lastOkTs: number | null = null;
  private lost = false;

  constructor(lostMs: number = TRACKING_LOST_MS) {
    this.lostMs = lostMs;
  }

  update(result: QualityResult, ts: number): QualityTransition {
    if (result.ok) {
      const recovered = this.lost;
      this.lost = false;
      this.lastOkTs = ts;
      return { quality: result.quality, enteredLost: false, recovered };
    }

    // Not ok this frame. Decide whether we've crossed into sustained loss.
    if (this.lastOkTs === null) {
      // Never had a good frame yet — treat as lost immediately.
      const enteredLost = !this.lost;
      this.lost = true;
      return { quality: 'lost', enteredLost, recovered: false };
    }

    const sinceOk = ts - this.lastOkTs;
    if (sinceOk >= this.lostMs) {
      const enteredLost = !this.lost;
      this.lost = true;
      return { quality: 'lost', enteredLost, recovered: false };
    }

    // Brief dropout — report the frame's own (poor) quality but not yet lost.
    return { quality: result.quality, enteredLost: false, recovered: false };
  }

  get isLost(): boolean {
    return this.lost;
  }

  reset(): void {
    this.lastOkTs = null;
    this.lost = false;
  }
}

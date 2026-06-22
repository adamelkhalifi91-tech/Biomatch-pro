/**
 * gazeMapper — ocular feature extraction (fx, fy) and head-pose proxy.
 *
 * Features (canonical, non-mirrored image space — see README):
 *   eye_center  = centroid of the eye-contour ring landmarks
 *   eye_width   = |inner canthus − outer canthus|
 *   eye_height  = |upper lid − lower lid|
 *   iris_center = centroid of the 5 iris landmarks (refineLandmarks model)
 *   fx = (iris_center.x − eye_center.x) / eye_width
 *   fy = (iris_center.y − eye_center.y) / eye_height
 *
 * Combination (per Phase 1 spec):
 *   both eyes valid → average; one valid → that one; none → invalid frame.
 *
 * Sign convention: fx > 0 ⇒ iris toward image-right; fy > 0 ⇒ iris downward.
 * The calibration polynomial absorbs the mapping to screen, so these signs only
 * need to be CONSISTENT between calibration and runtime, which they are because
 * both read the same non-mirrored hidden video.
 */

import type { EyeFeatures, GazeFeatures, HeadPose, Landmarks, Point2D, EyeSide } from './types';

// ── Landmark index sets ──────────────────────────────────────────────────────
// "right" = image-right eye (subject's left), "left" = image-left eye.

/** Iris landmarks (5 each) — requires FaceMesh refineLandmarks:true. */
const IRIS_RIGHT: readonly number[] = [468, 469, 470, 471, 472];
const IRIS_LEFT: readonly number[] = [473, 474, 475, 476, 477];

/** Outer/inner canthus (corners) per eye. */
const CANTHUS_RIGHT = { outer: 33, inner: 133 } as const;
const CANTHUS_LEFT = { outer: 263, inner: 362 } as const;

/** Upper/lower lid centre landmarks per eye. */
const LID_RIGHT = { top: 159, bottom: 145 } as const;
const LID_LEFT = { top: 386, bottom: 374 } as const;

/** Eye-contour ring landmarks for the centroid (subset of the FaceMesh ring). */
const RING_RIGHT: readonly number[] = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RING_LEFT: readonly number[] = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

/** Below this width/height (normalized image units) the eye is degenerate. */
const MIN_EYE_DIM = 0.004;

interface EyeIndexSet {
  iris: readonly number[];
  outer: number;
  inner: number;
  top: number;
  bottom: number;
  ring: readonly number[];
}

const RIGHT: EyeIndexSet = { iris: IRIS_RIGHT, ...CANTHUS_RIGHT, ...LID_RIGHT, ring: RING_RIGHT };
const LEFT: EyeIndexSet = { iris: IRIS_LEFT, ...CANTHUS_LEFT, ...LID_LEFT, ring: RING_LEFT };

function centroid(lm: Landmarks, idx: readonly number[]): Point2D | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const i of idx) {
    const p = lm[i];
    if (!p) return null;
    sx += p.x;
    sy += p.y;
    n += 1;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

function extractEye(lm: Landmarks, set: EyeIndexSet): EyeFeatures | null {
  const iris = centroid(lm, set.iris);
  const eyeCenter = centroid(lm, set.ring);
  const outer = lm[set.outer];
  const inner = lm[set.inner];
  const top = lm[set.top];
  const bottom = lm[set.bottom];
  if (!iris || !eyeCenter || !outer || !inner || !top || !bottom) return null;

  const eyeWidth = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  const eyeHeight = Math.hypot(top.x - bottom.x, top.y - bottom.y);
  if (eyeWidth < MIN_EYE_DIM || eyeHeight < MIN_EYE_DIM) return null;

  return {
    fx: (iris.x - eyeCenter.x) / eyeWidth,
    fy: (iris.y - eyeCenter.y) / eyeHeight,
    aperture: eyeHeight / eyeWidth,
  };
}

/** Extract features for a single eye, or null if its geometry is degenerate. */
export function extractEyeFeatures(lm: Landmarks, side: EyeSide): EyeFeatures | null {
  return extractEye(lm, side === 'right' ? RIGHT : LEFT);
}

/**
 * Combined binocular gaze features. `nEyes` reports how many eyes contributed;
 * 0 ⇒ the frame must be discarded by the caller.
 */
export function extractGazeFeatures(lm: Landmarks): GazeFeatures {
  const r = extractEye(lm, RIGHT);
  const l = extractEye(lm, LEFT);
  if (r && l) {
    return { fx: (r.fx + l.fx) / 2, fy: (r.fy + l.fy) / 2, nEyes: 2 };
  }
  if (r) return { fx: r.fx, fy: r.fy, nEyes: 1 };
  if (l) return { fx: l.fx, fy: l.fy, nEyes: 1 };
  return { fx: 0, fy: 0, nEyes: 0 };
}

// ── Head-pose proxy ──────────────────────────────────────────────────────────
// Geometric estimate from landmarks, NOT solvePnP: the @mediapipe/face_mesh JS
// solution does not expose facialTransformationMatrix. The empirical scalings
// (42, 88) and the 0.48 pitch offset map the normalized geometry into a roughly
// degree-like range; exact accuracy is unnecessary because the calibration
// polynomial rescales yaw/pitch through its own coefficients — only frame-to-
// frame consistency matters. Carried over from the previous working engine.

const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const CHEEK_LEFT = 234; // image-left
const CHEEK_RIGHT = 454; // image-right
const YAW_SCALE = 42;
const PITCH_SCALE = 88;
const PITCH_OFFSET = 0.48; // nose sits ~48% down the forehead→chin span when level

/** Estimate yaw/pitch/roll (degrees, proxy). Returns zeros if landmarks missing. */
export function estimateHeadPose(lm: Landmarks): HeadPose {
  const nose = lm[NOSE_TIP];
  const fore = lm[FOREHEAD];
  const chin = lm[CHIN];
  const cheekL = lm[CHEEK_LEFT];
  const cheekR = lm[CHEEK_RIGHT];
  const outerR = lm[CANTHUS_RIGHT.outer];
  const outerL = lm[CANTHUS_LEFT.outer];
  if (!nose || !fore || !chin || !cheekL || !cheekR) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const faceW = (cheekR.x - cheekL.x) || 1e-3;
  const faceH = (chin.y - fore.y) || 1e-3;
  const yaw = ((nose.x - (cheekL.x + cheekR.x) / 2) / (faceW * 0.5)) * YAW_SCALE;
  const pitch = ((nose.y - fore.y) / faceH - PITCH_OFFSET) * PITCH_SCALE;

  let roll = 0;
  if (outerR && outerL) {
    roll = (Math.atan2(outerL.y - outerR.y, outerL.x - outerR.x) * 180) / Math.PI;
  }
  return { yaw, pitch, roll };
}

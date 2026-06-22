/**
 * Shared types for the gaze pipeline.
 *
 * Coordinate spaces (see README.md — these are load-bearing):
 *  - LANDMARK space: raw MediaPipe normalized image coords, non-mirrored,
 *    x∈[0,1] image-left→right, y∈[0,1] top→bottom.
 *  - FEATURE space: fx, fy derived from landmarks (dimensionless ratios).
 *  - SCREEN space: percentage coordinates [0,100]×[0,100] of the target panel.
 */

/** A MediaPipe FaceMesh landmark (z is present with refineLandmarks). */
export interface Landmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export type Landmarks = ReadonlyArray<Landmark>;

/** A 2D point. Used for screen-space (%) and generic geometry. */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/** Which eye, in canonical (non-mirrored) image space. */
export type EyeSide = 'left' | 'right';

/**
 * Ocular features for one eye.
 * fx = (iris.x - eyeCenter.x) / eyeWidth   (positive ⇒ iris toward image-right)
 * fy = (iris.y - eyeCenter.y) / eyeHeight  (positive ⇒ iris toward image-bottom)
 */
export interface EyeFeatures {
  readonly fx: number;
  readonly fy: number;
  /** eye_height / eye_width — used as an openness proxy by the quality gate. */
  readonly aperture: number;
}

/** Combined binocular gaze features fed to the calibration polynomial. */
export interface GazeFeatures {
  readonly fx: number;
  readonly fy: number;
  /** How many eyes contributed (0, 1 or 2). 0 ⇒ unusable. */
  readonly nEyes: number;
}

/** Head pose in degrees. Geometric proxy, not solvePnP (see README). */
export interface HeadPose {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

/** Per-eye and mean Eye Aspect Ratio (Soukupová & Čech 2016). */
export interface EyeAspectRatios {
  readonly left: number;
  readonly right: number;
  readonly mean: number;
}

export type SignalQuality = 'good' | 'fair' | 'poor' | 'lost';

/** Why a frame was rejected by the quality gate (for UX hints + diagnostics). */
export type QualityReason =
  | 'no_face'
  | 'extreme_pose'
  | 'face_partial'
  | 'low_confidence'
  | 'low_light';

export interface QualityResult {
  /** True when the frame is good enough to feed the gaze pipeline. */
  readonly ok: boolean;
  readonly quality: SignalQuality;
  readonly reasons: ReadonlyArray<QualityReason>;
  /** Mean luminance (0–255) sampled around the eyes, when computable. */
  readonly eyeLuminance: number | null;
  /** Proxy detection confidence in [0,1] when FaceMesh doesn't report one. */
  readonly confidence: number;
}

/** One calibration observation: feature medians + the target the user fixated. */
export interface CalibrationSample {
  readonly fx: number;
  readonly fy: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly target: Point2D; // screen % the user was asked to look at
}

export type CalibrationQuality = 'good' | 'acceptable' | 'poor';

/** Coefficients for one axis: [a0, a1·fx, a2·fy, a3·yaw, a4·pitch, a5·fx², a6·fy², a7·fx·fy]. */
export type AxisCoefficients = readonly number[];

export interface CalibrationModel {
  /** Maps features + pose to a screen-% position (unclamped caller may clamp). */
  predict(features: { fx: number; fy: number }, pose?: { yaw?: number; pitch?: number }): Point2D;
  readonly coeffsX: AxisCoefficients;
  readonly coeffsY: AxisCoefficients;
  readonly hasPose: boolean;
  /** Leave-one-out CV error, Euclidean, in screen-% units. */
  readonly meanCVError: number;
  /** Same error as a fraction of the unit-square diagonal (√2·100). */
  readonly cvErrorFraction: number;
  readonly quality: CalibrationQuality;
  /** Per-axis monotonicity sanity flags (false ⇒ likely bad calibration data). */
  readonly xMonotonic: boolean;
  readonly yMonotonic: boolean;
}

/** A gaze position in screen %, timestamped. */
export interface GazeSample {
  readonly ts: number;
  readonly x: number;
  readonly y: number;
}

/** Fixation (Phase 2; declared here so types are stable across phases). */
export interface Fixation {
  readonly startTs: number;
  readonly endTs: number;
  readonly centroid: Point2D;
  readonly nSamples: number;
  readonly interrupted: boolean;
}

import { describe, it, expect } from 'vitest';
import {
  evaluateFrameQuality,
  QualityTracker,
  MAX_POSE_DEG,
} from '../qualityGate';
import type { Landmark } from '../types';

// A clean, well-detected face: all border landmarks safely interior and the
// confidence-proxy landmarks placed at a plausible inter-ocular ratio.
function goodLandmarks(overrides: Record<number, Landmark> = {}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  lm[234] = { x: 0.2, y: 0.5 }; // cheek left
  lm[454] = { x: 0.8, y: 0.5 }; // cheek right  → faceW 0.6
  lm[33] = { x: 0.32, y: 0.45 }; // outer canthus right
  lm[263] = { x: 0.74, y: 0.45 }; // outer canthus left → iod 0.42, ratio 0.7
  lm[10] = { x: 0.5, y: 0.2 }; // forehead
  lm[152] = { x: 0.5, y: 0.8 }; // chin
  return Object.assign(lm, overrides);
}

const FLAT_POSE = { yaw: 3, pitch: -2, roll: 0 };

describe('evaluateFrameQuality', () => {
  it('passes a clean frame', () => {
    const r = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks(),
      pose: FLAT_POSE,
      eyeLuminance: 130,
    });
    expect(r.ok).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(['good', 'fair']).toContain(r.quality);
  });

  it('drops a frame with no face → lost', () => {
    const r = evaluateFrameQuality({ hasFace: false });
    expect(r.ok).toBe(false);
    expect(r.quality).toBe('lost');
    expect(r.reasons).toContain('no_face');
  });

  it('drops an extreme-pose frame → poor', () => {
    const r = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks(),
      pose: { yaw: MAX_POSE_DEG + 5, pitch: 0, roll: 0 },
      eyeLuminance: 130,
    });
    expect(r.ok).toBe(false);
    expect(r.quality).toBe('poor');
    expect(r.reasons).toContain('extreme_pose');
  });

  it('drops a low-light frame', () => {
    const r = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks(),
      pose: FLAT_POSE,
      eyeLuminance: 20,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('low_light');
  });

  it('drops a partial-face frame (border landmark at the edge)', () => {
    const r = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks({ 152: { x: 0.5, y: 0.99 } }), // chin clipped
      pose: FLAT_POSE,
      eyeLuminance: 130,
    });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('face_partial');
  });

  it('skips the light check when luminance is null', () => {
    const r = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks(),
      pose: FLAT_POSE,
      eyeLuminance: null,
    });
    expect(r.reasons).not.toContain('low_light');
  });
});

describe('QualityTracker', () => {
  it('enters lost after sustained dropout and recovers on the next good frame', () => {
    const t = new QualityTracker(500);
    const good = evaluateFrameQuality({
      hasFace: true,
      landmarks: goodLandmarks(),
      pose: FLAT_POSE,
      eyeLuminance: 130,
    });
    const bad = evaluateFrameQuality({ hasFace: false });

    expect(t.update(good, 0).quality).toBe('good');
    // Brief dropout (< 500 ms) is not yet lost.
    expect(t.update(bad, 200).enteredLost).toBe(false);
    expect(t.isLost).toBe(false);
    // Crossing 500 ms enters lost exactly once.
    const crossed = t.update(bad, 600);
    expect(crossed.enteredLost).toBe(true);
    expect(crossed.quality).toBe('lost');
    expect(t.update(bad, 700).enteredLost).toBe(false); // already lost
    // Next good frame reports recovery.
    const rec = t.update(good, 800);
    expect(rec.recovered).toBe(true);
    expect(rec.quality).toBe('good');
  });
});

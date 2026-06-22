import { describe, it, expect } from 'vitest';
import { estimateHeadPose, extractEyeFeatures, extractGazeFeatures } from '../gazeMapper';
import type { Landmark } from '../types';

const RING_RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RING_LEFT = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const IRIS_RIGHT = [468, 469, 470, 471, 472];
const IRIS_LEFT = [473, 474, 475, 476, 477];

/**
 * Build a frame where each eye's contour centroid is at `cx` and its iris is
 * displaced by `irisDx` (image-x) and `irisDy` (image-y). Eye width 0.06,
 * height 0.04.
 */
function makeEyeFrame(irisDx: number, irisDy: number): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const buildEye = (ring: number[], iris: number[], outer: number, inner: number, top: number, bottom: number, cx: number) => {
    for (const i of ring) lm[i] = { x: cx, y: 0.5 };
    lm[outer] = { x: cx - 0.03, y: 0.5 };
    lm[inner] = { x: cx + 0.03, y: 0.5 }; // width 0.06
    lm[top] = { x: cx, y: 0.48 };
    lm[bottom] = { x: cx, y: 0.52 }; // height 0.04
    for (const i of iris) lm[i] = { x: cx + irisDx, y: 0.5 + irisDy };
  };
  buildEye(RING_RIGHT, IRIS_RIGHT, 33, 133, 159, 145, 0.35);
  buildEye(RING_LEFT, IRIS_LEFT, 263, 362, 386, 374, 0.65);
  return lm;
}

describe('gazeMapper feature extraction', () => {
  it('fx > 0 when the iris is displaced toward image-right', () => {
    const f = extractGazeFeatures(makeEyeFrame(0.012, 0));
    expect(f.nEyes).toBe(2);
    expect(f.fx).toBeGreaterThan(0);
    // fx = irisDx / eyeWidth = 0.012 / 0.06 = 0.2 (centroid offset ~0 by symmetry)
    expect(f.fx).toBeCloseTo(0.2, 1);
    expect(f.fy).toBeCloseTo(0, 2);
  });

  it('fy > 0 when the iris is displaced downward', () => {
    const f = extractGazeFeatures(makeEyeFrame(0, 0.008));
    expect(f.fy).toBeGreaterThan(0);
    expect(f.fx).toBeCloseTo(0, 2);
  });

  it('falls back to one eye when the other is degenerate', () => {
    const lm = makeEyeFrame(0.01, 0);
    // Collapse the left eye corners → zero width → invalid.
    lm[263] = { x: 0.65, y: 0.5 };
    lm[362] = { x: 0.65, y: 0.5 };
    const f = extractGazeFeatures(lm);
    expect(f.nEyes).toBe(1);
    expect(f.fx).toBeGreaterThan(0);
  });

  it('per-eye extraction returns null for collapsed geometry', () => {
    const lm = makeEyeFrame(0, 0);
    lm[33] = { x: 0.35, y: 0.5 };
    lm[133] = { x: 0.35, y: 0.5 }; // zero width
    expect(extractEyeFeatures(lm, 'right')).toBeNull();
  });
});

describe('estimateHeadPose', () => {
  it('returns ~level pose for a centred, symmetric face', () => {
    const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    lm[234] = { x: 0.2, y: 0.5 };
    lm[454] = { x: 0.8, y: 0.5 };
    lm[10] = { x: 0.5, y: 0.2 };
    lm[152] = { x: 0.5, y: 0.8 };
    lm[1] = { x: 0.5, y: 0.5 }; // nose centred, at ~48% would be pitch~0
    const pose = estimateHeadPose(lm);
    expect(Math.abs(pose.yaw)).toBeLessThan(1);
  });

  it('yaw becomes positive-or-negative as the nose shifts off-centre', () => {
    const base: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    base[234] = { x: 0.2, y: 0.5 };
    base[454] = { x: 0.8, y: 0.5 };
    base[10] = { x: 0.5, y: 0.2 };
    base[152] = { x: 0.5, y: 0.8 };
    base[1] = { x: 0.62, y: 0.5 }; // nose toward image-right
    const pose = estimateHeadPose(base);
    expect(pose.yaw).not.toBeCloseTo(0, 1);
  });
});

import { describe, it, expect } from 'vitest';
import { BlinkDetector, computeEyeAspectRatios } from '../blinkDetector';
import type { Landmark } from '../types';

// Build a 478-landmark frame whose two eyes produce a target EAR.
// EAR = vertical / horizontal; we fix horizontal = 0.06 and set vertical = ear*0.06.
function makeFrame(ear: number): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const vert = ear * 0.06;
  const place = (
    corners: [number, number],
    pair1: [number, number],
    pair2: [number, number],
    cx: number,
  ) => {
    const [c1, c2] = corners;
    lm[c1] = { x: cx - 0.03, y: 0.5 };
    lm[c2] = { x: cx + 0.03, y: 0.5 };
    lm[pair1[0]] = { x: cx - 0.01, y: 0.5 - vert / 2 };
    lm[pair1[1]] = { x: cx - 0.01, y: 0.5 + vert / 2 };
    lm[pair2[0]] = { x: cx + 0.01, y: 0.5 - vert / 2 };
    lm[pair2[1]] = { x: cx + 0.01, y: 0.5 + vert / 2 };
  };
  // RIGHT_EYE_EAR = [33,160,158,133,153,144] → corners 33/133, pairs (160,144),(158,153)
  place([33, 133], [160, 144], [158, 153], 0.35);
  // LEFT_EYE_EAR = [362,385,387,263,373,380] → corners 362/263, pairs (385,380),(387,373)
  place([362, 263], [385, 380], [387, 373], 0.65);
  return lm;
}

describe('computeEyeAspectRatios', () => {
  it('computes the expected EAR from landmark geometry', () => {
    const ear = computeEyeAspectRatios(makeFrame(0.3));
    expect(ear.left).toBeCloseTo(0.3, 5);
    expect(ear.right).toBeCloseTo(0.3, 5);
    expect(ear.mean).toBeCloseTo(0.3, 5);
  });
});

describe('BlinkDetector', () => {
  it('detects an injected blink and flags its frames for exclusion', () => {
    const d = new BlinkDetector(); // threshold 0.21, min 2 frames
    // open, open, blink(3 sub-threshold), open, open
    const earSeq = [0.30, 0.30, 0.10, 0.08, 0.12, 0.30, 0.30];
    const results = earSeq.map((e) => d.update(e));

    // Open frames are not excluded and never flagged as blink.
    expect(results[0]!.shouldExclude).toBe(false);
    expect(results[1]!.shouldExclude).toBe(false);
    expect(results[0]!.isBlink).toBe(false);

    // Blink frames are all excluded; the event is confirmed from the 2nd frame.
    expect(results[2]!.shouldExclude).toBe(true);
    expect(results[2]!.isBlink).toBe(false); // 1 consecutive so far
    expect(results[3]!.shouldExclude).toBe(true);
    expect(results[3]!.isBlink).toBe(true); // 2 consecutive ⇒ confirmed
    expect(results[4]!.isBlink).toBe(true);

    // Exactly one blink event counted; back to open afterward.
    const last = results[results.length - 1]!;
    expect(last.blinkCount).toBe(1);
    expect(last.shouldExclude).toBe(false);
    expect(last.isBlink).toBe(false);
  });

  it('does not count a single isolated sub-threshold frame as an event', () => {
    const d = new BlinkDetector();
    const seq = [0.3, 0.15, 0.3, 0.3];
    const res = seq.map((e) => d.update(e));
    expect(res[1]!.shouldExclude).toBe(true); // still excluded
    expect(res[1]!.isBlink).toBe(false); // but not a confirmed event
    expect(res[3]!.blinkCount).toBe(0);
  });

  it('works end-to-end from landmark frames', () => {
    const d = new BlinkDetector();
    const open = d.updateFromLandmarks(makeFrame(0.3));
    expect(open.shouldExclude).toBe(false);
    d.updateFromLandmarks(makeFrame(0.05));
    const closed2 = d.updateFromLandmarks(makeFrame(0.05));
    expect(closed2.shouldExclude).toBe(true);
    expect(closed2.isBlink).toBe(true);
  });
});

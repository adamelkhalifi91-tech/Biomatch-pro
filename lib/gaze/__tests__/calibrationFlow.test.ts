import { describe, it, expect } from 'vitest';
import { aggregatePoint, CalibrationCollector } from '../calibrationFlow';
import type { Point2D } from '../types';

const target: Point2D = { x: 50, y: 50 };

function rawBuffer(n: number, fx: number, fy: number) {
  return Array.from({ length: n }, (_, i) => ({ fx, fy, yaw: 1, pitch: 2, ts: i }));
}

describe('aggregatePoint', () => {
  it('drops the leading 20% transient and medians the rest', () => {
    // First 20% have a wild transient value; median of the rest is the truth.
    const buf = [
      { fx: 99, fy: 99, yaw: 0, pitch: 0, ts: 0 },
      { fx: 99, fy: 99, yaw: 0, pitch: 0, ts: 1 },
      { fx: 99, fy: 99, yaw: 0, pitch: 0, ts: 2 },
      ...rawBuffer(12, 0.2, -0.1),
    ];
    const s = aggregatePoint(buf, target, 0.2, 12);
    expect(s).not.toBeNull();
    expect(s!.fx).toBeCloseTo(0.2, 6);
    expect(s!.fy).toBeCloseTo(-0.1, 6);
    expect(s!.target).toEqual(target);
  });

  it('returns null when too few samples survive the transient cut', () => {
    const buf = rawBuffer(10, 0.1, 0.1); // 10 → after 20% cut = 8 < 12
    expect(aggregatePoint(buf, target, 0.2, 12)).toBeNull();
  });
});

describe('CalibrationCollector', () => {
  const points: Point2D[] = [
    { x: 5, y: 5 }, { x: 50, y: 5 }, { x: 95, y: 5 },
    { x: 5, y: 50 }, { x: 50, y: 50 }, { x: 95, y: 50 },
    { x: 5, y: 95 }, { x: 50, y: 95 }, { x: 95, y: 95 },
  ];

  it('accepts points and completes after all nine', () => {
    const c = new CalibrationCollector(points, { minValid: 12, maxRetries: 3 });
    for (let p = 0; p < points.length; p++) {
      for (let i = 0; i < 20; i++) c.addSample({ fx: 0.1, fy: 0.1, yaw: 0, pitch: 0, ts: i });
      const res = c.finalizePoint();
      if (p < points.length - 1) {
        expect(res.status).toBe('accepted');
      } else {
        expect(res.status).toBe('complete');
        if (res.status === 'complete') expect(res.samples).toHaveLength(9);
      }
    }
  });

  it('retries a sparse point, then fails after exceeding max retries', () => {
    const c = new CalibrationCollector(points, { minValid: 12, maxRetries: 2 });
    // Always feed too few samples → retry, retry, then fail.
    const feedSparse = () => {
      for (let i = 0; i < 4; i++) c.addSample({ fx: 0, fy: 0, yaw: 0, pitch: 0, ts: i });
      return c.finalizePoint();
    };
    expect(feedSparse().status).toBe('retry');
    expect(feedSparse().status).toBe('retry');
    expect(feedSparse().status).toBe('failed');
  });

  it('stays on the same index across a retry', () => {
    const c = new CalibrationCollector(points, { minValid: 12, maxRetries: 3 });
    c.addSample({ fx: 0, fy: 0, yaw: 0, pitch: 0, ts: 0 }); // too few
    const r = c.finalizePoint();
    expect(r.status).toBe('retry');
    expect(c.currentIndex).toBe(0);
  });
});

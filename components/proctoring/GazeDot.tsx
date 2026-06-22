/**
 * GazeDot — renders the gaze cursor in a 60 FPS loop fully DECOUPLED from the
 * detector loop (which runs at DETECTOR_FPS, e.g. 15 FPS).
 *
 * Each animation frame it reads the latest filtered target from `getTarget()`
 * and eases the rendered position toward it with a short exponential easing
 * (RENDER_EASING). This hides detector frame drops and the low detector rate:
 * even at 15 FPS the dot glides instead of teleporting, which is the core fix
 * for "el punto vibra y se mueve a saltos".
 *
 * The element is mutated directly via refs (no React state per frame) to avoid
 * 60 re-renders/second.
 */

import { useEffect, useRef } from 'react';
import { RENDER_EASING } from '../../lib/gaze/gazeRuntime';
import type { Point2D } from '../../lib/gaze/types';

export interface GazeDotProps {
  /** Returns the latest smoothed target in screen % (0–100), or null if none. */
  getTarget: () => Point2D | null;
  /** Exponential easing factor per 60 FPS frame. */
  easing?: number;
  /** Margin (%) inside which the dot is "on screen"; outside ⇒ red. */
  offScreenMarginPct?: number;
  /** Dot diameter in px. */
  size?: number;
  /** Master visibility (e.g. only show when a calibration model exists). */
  visible?: boolean;
  /** Stacking order over the video. */
  zIndex?: number;
}

export default function GazeDot({
  getTarget,
  easing = RENDER_EASING,
  offScreenMarginPct = 5,
  size = 14,
  visible = true,
  zIndex = 9,
}: GazeDotProps) {
  const dotRef = useRef<HTMLDivElement | null>(null);
  // Rendered position persists across frames; null until the first target.
  const renderedRef = useRef<Point2D | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = dotRef.current;
      if (!el) return;

      const target = visible ? getTarget() : null;
      if (!target) {
        el.style.opacity = '0';
        return;
      }

      const prev = renderedRef.current ?? target;
      const next: Point2D = {
        x: prev.x + (target.x - prev.x) * easing,
        y: prev.y + (target.y - prev.y) * easing,
      };
      renderedRef.current = next;

      const offScreen =
        next.x < offScreenMarginPct ||
        next.x > 100 - offScreenMarginPct ||
        next.y < offScreenMarginPct ||
        next.y > 100 - offScreenMarginPct;

      el.style.opacity = '1';
      el.style.left = `${next.x}%`;
      el.style.top = `${next.y}%`;
      el.style.background = offScreen ? 'rgba(255,60,60,0.85)' : 'rgba(0,113,227,0.85)';
      el.style.boxShadow = offScreen
        ? '0 0 12px rgba(255,60,60,0.6)'
        : '0 0 12px rgba(0,113,227,0.55)';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTarget, easing, offScreenMarginPct, visible]);

  return (
    <div
      ref={dotRef}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.35)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        opacity: 0,
        zIndex,
        // left/top/background are driven imperatively in the rAF loop.
        transition: 'background 0.15s ease',
      }}
    />
  );
}

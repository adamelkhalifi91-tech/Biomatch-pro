/**
 * One Euro Filter — speed-adaptive low-pass smoothing.
 *
 * Reference: Casiez, Roussel & Vogel (2012). "1€ Filter: A Simple Speed-Based
 * Low-Pass Filter for Noisy Input in Interactive Systems." CHI 2012.
 *
 * The filter smooths heavily when the signal is still (kills sub-pixel iris
 * jitter that the screen-space mapping amplifies) and relaxes smoothing as the
 * signal moves fast (avoids lag on saccades). This is the de-facto standard for
 * client-side gaze/cursor smoothing.
 *
 * IMPORTANT: applied to the polynomial's SCREEN-space output, never to raw
 * landmarks (per the Phase 1 spec). Blink/quality-rejected frames must not be
 * fed in — skip the call entirely rather than passing a poisoned sample.
 */

export interface OneEuroParams {
  /**
   * minCutoff (Hz): the low-pass cutoff at zero speed. Lower ⇒ smoother at rest
   * but more lag. Default 1.0 Hz — the value recommended by Casiez et al. as a
   * sane starting point for interactive pointing.
   */
  minCutoff?: number;
  /**
   * beta: how much the cutoff rises with speed. Higher ⇒ less lag when moving
   * fast (raise if the dot feels sluggish); lower ⇒ steadier when still (lower
   * if it vibrates at rest). Default 0.007 per the Phase 1 spec.
   */
  beta?: number;
  /**
   * dCutoff (Hz): cutoff of the low-pass applied to the derivative estimate.
   * Default 1.0 Hz (Casiez et al.).
   */
  dCutoff?: number;
}

const TWO_PI = 2 * Math.PI;

/** Smoothing factor for a first-order low-pass given cutoff (Hz) and dt (s). */
function smoothingAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (TWO_PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** Scalar One Euro Filter. */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 }: OneEuroParams = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  /**
   * Filter one sample.
   * @param x value to smooth
   * @param t timestamp in SECONDS (defaults to performance.now()/1000)
   */
  filter(x: number, t: number = performance.now() / 1000): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.tPrev = t;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    // Clamp dt to a small positive floor so a duplicated timestamp can't blow up
    // the derivative. 1 ms floor ≈ far below any real detector interval.
    const dt = Math.max(1e-3, t - this.tPrev);

    const dx = (x - this.xPrev) / dt;
    const aD = smoothingAlpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingAlpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;
    return xHat;
  }

  /**
   * Reset to the uninitialized state. After reset the next sample is returned
   * verbatim (no jump) — used on tracking_lost recovery so the dot doesn't snap.
   */
  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /** Whether the filter has seen at least one sample since construction/reset. */
  get initialized(): boolean {
    return this.xPrev !== null;
  }
}

/** 2D composition of two independent One Euro filters (x and y). */
export class OneEuroFilter2D {
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  constructor(params: OneEuroParams = {}) {
    this.fx = new OneEuroFilter(params);
    this.fy = new OneEuroFilter(params);
  }

  filter(x: number, y: number, t: number = performance.now() / 1000): { x: number; y: number } {
    return { x: this.fx.filter(x, t), y: this.fy.filter(y, t) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }

  get initialized(): boolean {
    return this.fx.initialized;
  }
}

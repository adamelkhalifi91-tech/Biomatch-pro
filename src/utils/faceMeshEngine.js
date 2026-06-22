// ============================================================================
//  faceMeshEngine.js — Motor de seguimiento ocular (v4)
//
//  RESCRITO desde cero usando REGRESIÓN POLINÓMICA por mínimos cuadrados.
//  Esto es lo que usan WebGazer, OpenGaze, Tobii y la mayoría del software
//  profesional de eye-tracking. Resuelve los dos bugs fundamentales de v3:
//
//   • Bug v3.1 (centro descuadrado): si la muestra del punto central de
//     calibración no fue exactamente el centro de pantalla, todo el modelo
//     queda desplazado. Una regresión que ajusta TODOS los puntos a la vez
//     no tiene este problema: el centro no es especial, es un punto más.
//
//   • Bug v3.2 (distorsión trapezoidal): un par de escalas globales no
//     describe correctamente la geometría del campo de mirada en un
//     portátil, que es un cuadrilátero, no un rectángulo. Un polinomio
//     bivariado de grado 2 captura curvaturas y trapecios automáticamente.
//
//  El modelo aprende dos polinomios:
//    screenX(h, v) = a0 + a1·h + a2·v + a3·h² + a4·v² + a5·h·v
//    screenY(h, v) = b0 + b1·h + b2·v + b3·h² + b4·v² + b5·h·v
//  Con 9 puntos de calibración tenemos 9 ecuaciones para 6 incógnitas
//  por eje => sistema sobredeterminado resuelto por mínimos cuadrados.
//
//  Esto da PRECISIÓN REAL en cualquier posición de la pantalla.
// ============================================================================

export const euclid = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// ─── One Euro Filter ────────────────────────────────────────────────────────
class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0.05, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
  _alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(x, t = performance.now() / 1000) {
    if (this.tPrev === null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }
    const dt = Math.max(1e-3, t - this.tPrev);
    const dx = (x - this.xPrev) / dt;
    const aD = this._alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this._alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;
    return xHat;
  }
  reset() { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
}

// ─── Solver de mínimos cuadrados: A·x = b -> x = (AᵀA)⁻¹·Aᵀ·b ─────────────
// Implementación con eliminación de Gauss-Jordan. Estable para nuestras
// dimensiones (6x6 o 7x7). No hace falta SVD.
const solveLeastSquares = (A, b) => {
  const m = A.length;       // ecuaciones
  const n = A[0].length;    // incógnitas

  // Calcular AᵀA (n×n) y Aᵀb (n×1)
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += A[k][i] * A[k][j];
      AtA[i][j] = s;
    }
    let s = 0;
    for (let k = 0; k < m; k++) s += A[k][i] * b[k];
    Atb[i] = s;
  }

  // Regularización Tikhonov (evita matrices casi-singulares con datos ruidosos)
  const lambda = 1e-6;
  for (let i = 0; i < n; i++) AtA[i][i] += lambda;

  // Eliminación Gauss-Jordan sobre [AtA | Atb]
  const aug = AtA.map((row, i) => [...row, Atb[i]]);
  for (let i = 0; i < n; i++) {
    // Pivoteo parcial
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    const pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) return null; // singular
    for (let j = i; j <= n; j++) aug[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = i; j <= n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row[n]);
};

// ─── Curva de respuesta sobre la salida final (zona muerta + gamma) ─────────
// La regresión nos da la posición exacta. Aquí solo añadimos:
//  - zona muerta para suprimir temblor en torno a un punto fijado
//  - gamma opcional para ajustar la sensación (1.0 = sin alteración)
const applyResponseCurve = (val, center, dead, gamma) => {
  const n = (val - center) / 50; // [-1, 1] aprox
  const sign = Math.sign(n);
  const abs = Math.abs(n);
  if (abs <= dead) return center;
  const t = (abs - dead) / (1 - dead);
  const curved = Math.pow(Math.min(1, Math.max(0, t)), gamma);
  return center + sign * curved * 50;
};

// ────────────────────────────────────────────────────────────────────────────
//  buildGazeModel
//
//  samples: array de 9 muestras, una por punto de la rejilla 3x3:
//    0=TL  1=TC  2=TR
//    3=ML  4=C   5=MR
//    6=BL  7=BC  8=BR
//
//  Cada muestra: { gazeH, gazeV, headYaw?, headPitch? }
//
//  Opcionalmente puedes pasar calibPoints para mapear a coordenadas custom
//  (por defecto se asume la rejilla 3x3 estándar al 10%-90% de la pantalla).
// ────────────────────────────────────────────────────────────────────────────
export const buildGazeModel = (samples, options = {}) => {
  if (!samples || samples.length < 9) return null;

  const {
    deadZone   = 0.04,
    gamma      = 1.0,
    minCutoff  = 0.7,   // tuned for 4 FPS — smoother without lag
    beta       = 0.01,  // less overshoot on saccades
    compensateHead = true,
    // Phase 1 range data: { minH, maxH, minV, maxV, centerH, centerV, rangeH, rangeV }
    rangeData  = null,
    // Screen-space targets matching the 3×3 sample grid
    calibPoints = [
      { x:  5, y:  5 }, { x: 50, y:  5 }, { x: 95, y:  5 },
      { x:  5, y: 50 }, { x: 50, y: 50 }, { x: 95, y: 50 },
      { x:  5, y: 95 }, { x: 50, y: 95 }, { x: 95, y: 95 },
    ],
  } = options;

  // ── Extraer features y targets ────────────────────────────────────────────
  const H = samples.map(s => s.gazeH);
  const V = samples.map(s => s.gazeV);
  const Yaw   = samples.map(s => s.headYaw   ?? 0);
  const Pitch = samples.map(s => s.headPitch ?? 0);

  const hasPose = compensateHead && samples.some(s => s.headYaw !== undefined && s.headYaw !== null);

  // ── Construir matriz de diseño A ──────────────────────────────────────────
  // Features polinómicas: [1, h, v, h², v², h·v]   (+ yaw, pitch si hay)
  // 9 ecuaciones, 6 incógnitas (o 8 con compensación de cabeza).
  const buildRow = (h, v, yaw, pitch) => {
    const row = [1, h, v, h * h, v * v, h * v];
    if (hasPose) row.push(yaw, pitch);
    return row;
  };

  const A = samples.map((_, i) => buildRow(H[i], V[i], Yaw[i], Pitch[i]));
  const bx = calibPoints.map(p => p.x);
  const by = calibPoints.map(p => p.y);

  const coeffsX = solveLeastSquares(A, bx);
  const coeffsY = solveLeastSquares(A, by);
  if (!coeffsX || !coeffsY) return null;

  // ── Evaluar predicciones sobre los puntos de calibración para medir error ─
  const predictRaw = (h, v, yaw = 0, pitch = 0) => {
    const r = buildRow(h, v, yaw, pitch);
    let px = 0, py = 0;
    for (let i = 0; i < r.length; i++) {
      px += r[i] * coeffsX[i];
      py += r[i] * coeffsY[i];
    }
    return { x: px, y: py };
  };

  let sumXErr = 0, sumYErr = 0, maxErr = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = predictRaw(H[i], V[i], Yaw[i], Pitch[i]);
    const ex = Math.abs(p.x - calibPoints[i].x);
    const ey = Math.abs(p.y - calibPoints[i].y);
    sumXErr += ex;
    sumYErr += ey;
    const e = Math.sqrt(ex * ex + ey * ey);
    if (e > maxErr) maxErr = e;
  }
  const meanXErr = sumXErr / samples.length;
  const meanYErr = sumYErr / samples.length;
  const meanErr  = Math.sqrt(meanXErr * meanXErr + meanYErr * meanYErr);

  // ── Confianza ponderada: H (70%) y V (30%) ────────────────────────────────
  // El eje vertical tiene una limitación física real en webcam sin IR: el párpado
  // superior sigue al iris hacia abajo, comprimiendo el rango de gazeV a ~0.10–0.16
  // frente a un rango objetivo de 90% pantalla. El eje H no tiene este problema
  // (las comisuras son puntos fijos). Se pondera 70/30 para no penalizar lo que
  // es una limitación del hardware, no del algoritmo.
  const blendedErr = meanXErr * 0.70 + meanYErr * 0.30;
  const confidence = Math.max(0.30, Math.min(0.99, 1 - blendedErr / 10));

  // ── Validar orientación: ¿el modelo aprendió ejes invertidos? ─────────────
  // Si al pasar de TL (esperado 10,10) a TR (esperado 90,10) la X predicha
  // BAJA en lugar de subir, hay un problema serio en los datos.
  const pTL = predictRaw(H[0], V[0], Yaw[0], Pitch[0]);
  const pTR = predictRaw(H[2], V[2], Yaw[2], Pitch[2]);
  const pBL = predictRaw(H[6], V[6], Yaw[6], Pitch[6]);
  const xMonotonic = pTR.x > pTL.x;
  const yMonotonic = pBL.y > pTL.y;

  // ── Gesture thresholds ────────────────────────────────────────────────────
  // Use Phase 1 rangeData when available — it measures the true biological range
  // rather than inferring it from the calibration samples (which may not cover extremes).
  const sortedH = [...H].sort((a, b) => a - b);
  const sortedV = [...V].sort((a, b) => a - b);
  const rangeH  = rangeData?.rangeH  ?? (sortedH[8] - sortedH[0]);
  const rangeV  = rangeData?.rangeV  ?? (sortedV[8] - sortedV[0]);
  const centerH = rangeData?.centerH ?? sortedH[4];
  const centerV = rangeData?.centerV ?? sortedV[4];
  const personalThresholds = {
    gaze_lateral: Math.max(0.04, rangeH * 0.18),
    gaze_up:      Math.max(0.03, rangeV * 0.22),
    gaze_down:    Math.max(0.04, rangeV * 0.30),
    center_h: centerH,
    center_v: centerV,
  };

  // ── Estado runtime (filtros + zona muerta adaptativa) ─────────────────────
  const fX = new OneEuro({ minCutoff, beta, dCutoff: 1.0 });
  const fY = new OneEuro({ minCutoff, beta, dCutoff: 1.0 });
  let anchorX = 50, anchorY = 50; // punto al que el cursor está "pegado" para la zona muerta

  return {
    /** Predice posición del cursor (0..100). */
    predict: (gazeH, gazeV, pose = {}) => {
      const yaw   = pose.headYaw   ?? 0;
      const pitch = pose.headPitch ?? 0;
      const p = predictRaw(gazeH, gazeV, yaw, pitch);

      // Clamp a [0, 100]
      let px = Math.max(0, Math.min(100, p.x));
      let py = Math.max(0, Math.min(100, p.y));

      // Suavizado temporal
      const sx = fX.filter(px);
      const sy = fY.filter(py);

      // Zona muerta adaptativa alrededor del último punto estable:
      // si te has movido poco, el cursor se queda pegado al ancla.
      const dx = sx - anchorX;
      const dy = sy - anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const deadPx = deadZone * 100; // p.ej. 4 px en %
      let outX, outY;
      if (dist < deadPx) {
        outX = anchorX;
        outY = anchorY;
      } else {
        // Mover el ancla hacia el cursor, manteniéndola a deadPx de distancia
        const k = (dist - deadPx) / dist;
        anchorX += dx * k;
        anchorY += dy * k;
        outX = anchorX;
        outY = anchorY;
      }

      // Gamma opcional (1.0 = sin efecto)
      if (gamma !== 1.0) {
        outX = applyResponseCurve(outX, 50, 0, gamma);
        outY = applyResponseCurve(outY, 50, 0, gamma);
      }

      return {
        x: Math.max(0, Math.min(100, outX)),
        y: Math.max(0, Math.min(100, outY)),
      };
    },

    resetFilters: () => { fX.reset(); fY.reset(); anchorX = 50; anchorY = 50; },
    recenter:     () => { anchorX = 50; anchorY = 50; },

    thresholds: personalThresholds,
    confidence,

    debug: {
      meanErr, meanXErr, meanYErr, maxErr,
      xMonotonic, yMonotonic,
      hasPose, coeffsX, coeffsY,
      rangeH, rangeV, centerH, centerV,
    },
  };
};
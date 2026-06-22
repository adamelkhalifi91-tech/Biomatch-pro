import React from 'react';
import { CalibrationCollector } from '../../lib/gaze/calibrationFlow.ts';
import { buildRuntimeModel } from '../../lib/gaze/gazeRuntime.ts';

// 9-point 3×3 grid with a 5% interior margin over the target rectangle
// (the full mobile panel — see lib/gaze/README.md).
const POINTS = [
  { x:  5, y:  5 }, { x: 50, y:  5 }, { x: 95, y:  5 },
  { x:  5, y: 50 }, { x: 50, y: 50 }, { x: 95, y: 50 },
  { x:  5, y: 95 }, { x: 50, y: 95 }, { x: 95, y: 95 },
];

// Timing — tuned for the 15 FPS detector (≈66 ms/frame, see gazeRuntime).
const INTRO_MS    = 3000;  // positioning instructions before calibration starts
const WAIT_MS     = 700;   // let the fixation settle before collecting
const COLLECT_MS  = 1700;  // ≈25 raw frames at 15 FPS → ≥12 after transient+blink
const STABLE_MIN  = 12;    // green dot once enough valid samples are buffered
const POOR_HINT_MS = 2000; // surface a signal hint after sustained poor signal

const qualityLabel = (q) =>
  q === 'good' ? 'buena' : q === 'acceptable' ? 'aceptable' : 'pobre, recalibrar recomendado';

const ScreenCalibration = ({ setPoseHandler, onComplete, videoRef }) => {
  const [started,  setStarted]  = React.useState(false);
  const [pointIdx, setPointIdx] = React.useState(0);
  const [phase,    setPhase]    = React.useState('waiting');
  const [fillPct,  setFillPct]  = React.useState(0);
  const [stable,   setStable]   = React.useState(false);
  const [hint,     setHint]     = React.useState('');
  const [retry,    setRetry]    = React.useState(0);
  const [done,     setDone]     = React.useState(false);
  const [failed,   setFailed]   = React.useState(false);
  const [result,   setResult]   = React.useState(null); // { conf, quality, cvPct }

  const collectorRef = React.useRef(new CalibrationCollector(POINTS, { minValid: STABLE_MIN, maxRetries: 3 }));
  const phaseRef     = React.useRef('waiting');
  const startRef     = React.useRef(Date.now());
  const poorStartRef = React.useRef(null);

  // Camera preview
  React.useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    }).catch(() => {});
  }, []);

  // 3-second preparation intro, then start the point sequence.
  React.useEffect(() => {
    const t = setTimeout(() => { startRef.current = Date.now(); setStarted(true); }, INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    setPoseHandler?.((frame) => {
      if (!started || phaseRef.current === 'done') return;
      const now = Date.now();

      // Signal-quality hints (1.7): after sustained poor/lost signal, tell the
      // user what to fix instead of silently stalling.
      if (frame.signalQuality === 'poor' || frame.signalQuality === 'lost') {
        if (!poorStartRef.current) poorStartRef.current = now;
        else if (now - poorStartRef.current > POOR_HINT_MS) {
          setHint(frame.signalQuality === 'lost'
            ? 'Acércate y mira directamente a la cámara'
            : 'Mejora la iluminación y centra tu rostro');
        }
      } else {
        poorStartRef.current = null;
      }

      const usable =
        frame.hasFace && frame.gaze && !frame.isBlink &&
        (frame.signalQuality === 'good' || frame.signalQuality === 'fair');

      const elapsed = now - startRef.current;
      const ph = phaseRef.current;

      if (ph === 'waiting') {
        setFillPct(0); setStable(false);
        if (elapsed >= WAIT_MS) { phaseRef.current = 'collecting'; setPhase('collecting'); }
        return;
      }

      // collecting
      const ce = elapsed - WAIT_MS;
      if (usable) {
        collectorRef.current.addSample({
          fx: frame.gaze.h, fy: frame.gaze.v,
          yaw: frame.yaw, pitch: frame.pitch, ts: now,
        });
      }
      setFillPct(Math.min(100, (ce / COLLECT_MS) * 100));
      setStable(collectorRef.current.sampleCount >= STABLE_MIN);
      if (ce < COLLECT_MS) return;

      // Window closed — evaluate the point.
      const res = collectorRef.current.finalizePoint();
      if (res.status === 'retry') {
        setRetry(res.retries);
        if (!hint) setHint('Mantén la vista fija en el punto y evita parpadear');
        phaseRef.current = 'waiting'; setPhase('waiting');
        setFillPct(0); setStable(false); startRef.current = now;
        return;
      }
      if (res.status === 'failed') {
        phaseRef.current = 'done'; setFailed(true);
        return;
      }
      if (res.status === 'accepted') {
        setRetry(0); setHint('');
        setPointIdx(collectorRef.current.currentIndex);
        phaseRef.current = 'waiting'; setPhase('waiting');
        setFillPct(0); setStable(false); startRef.current = now;
        return;
      }
      // complete
      phaseRef.current = 'done';
      const model = buildRuntimeModel(res.samples, { compensateHead: true });
      if (!model) { setFailed(true); return; }
      setResult({
        conf: model.confidence,
        quality: model.quality,
        cvPct: model.cvErrorFraction * 100,
      });
      setDone(true);
      setTimeout(() => onComplete(model), 1100);
    });
    return () => setPoseHandler?.(null);
  }, [started]);

  const handleRetry = () => {
    collectorRef.current.reset();
    poorStartRef.current = null;
    setFailed(false); setDone(false); setResult(null);
    setPointIdx(0); setRetry(0); setHint('');
    setPhase('waiting'); phaseRef.current = 'waiting';
    setFillPct(0); setStable(false);
    startRef.current = Date.now();
  };

  const pt   = POINTS[pointIdx];
  const circ = 2 * Math.PI * 18;
  const dotColor = phase === 'collecting' ? (stable ? '#00ffaa' : '#0071e3') : '#0071e3';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', background: '#1d1d1f', overflow: 'hidden', fontFamily: 'Inter,sans-serif' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', transform: 'scaleX(-1)',
        filter: 'brightness(0.28) contrast(1.1) saturate(0.5)',
      }} />

      {/* Preparation intro */}
      {!started && !failed && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', zIndex: 6 }}>
          <p style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 10 }}>Calibración ocular</p>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#f0f0f0', marginBottom: 12 }}>Preparémonos</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, maxWidth: 320 }}>
            Sitúate a ~50–60&nbsp;cm de la pantalla, con los ojos centrados en la webcam y, si es posible, sin gafas reflejantes.
          </p>
        </div>
      )}

      {/* Instructions — top */}
      {started && !done && !failed && (
        <div style={{ position: 'absolute', top: 48, left: 0, right: 0, textAlign: 'center', padding: '0 28px', zIndex: 5 }}>
          <p style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>Calibración ocular</p>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>{hint ? 'Un momento más' : 'Mira el punto con calma'}</h2>
          <p style={{ fontSize: 12, color: hint ? '#fbbf24' : '#6b7280', lineHeight: 1.6 }}>{hint || 'Fija la vista. Pequeños movimientos son normales.'}</p>
        </div>
      )}

      {/* Calibration dot */}
      {started && !done && !failed && pt && (
        <div style={{ position: 'absolute', left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10, transition: 'left 0.4s cubic-bezier(.16,1,.3,1), top 0.4s cubic-bezier(.16,1,.3,1)' }}>
          <svg width={44} height={44} style={{ position: 'absolute', top: -22, left: -22, transform: 'rotate(-90deg)' }}>
            <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2.5} />
            <circle cx={22} cy={22} r={18} fill="none" stroke={dotColor} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (fillPct / 100) * circ} style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.3s ease' }} />
          </svg>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, boxShadow: stable ? '0 0 16px rgba(0,255,170,0.9)' : '0 0 12px rgba(0,113,227,0.8)', transition: 'background 0.3s ease, box-shadow 0.3s ease' }} />
        </div>
      )}

      {/* Progress — bottom */}
      {started && !done && !failed && (
        <div style={{ position: 'absolute', bottom: 64, left: 0, right: 0, textAlign: 'center', zIndex: 5 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', marginBottom: 10 }}>
            {pointIdx + 1} / {POINTS.length}
            {retry > 0 && <span style={{ color: '#fbbf24', marginLeft: 8 }}>· Reintento {retry}/3</span>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
            {POINTS.map((_, i) => (
              <div key={i} style={{ width: i === pointIdx ? 14 : 6, height: 6, borderRadius: 3, background: i < pointIdx ? '#0071e3' : i === pointIdx ? '#60aaff' : 'rgba(255,255,255,0.10)', transition: 'all 0.3s ease' }} />
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {done && result && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,255,170,0.1)', border: '1.5px solid rgba(0,255,170,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, color: '#00ffaa' }}>✓</div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Calibración completada</p>
          <p style={{ fontSize: 13, color: result.quality === 'poor' ? '#fbbf24' : '#9ca3af', marginBottom: 14 }}>
            Calibración: {qualityLabel(result.quality)}
          </p>
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '.5px' }}>PRECISIÓN</span>
              <span style={{ fontSize: 10, color: '#00ffaa', fontWeight: 700 }}>{Math.round(result.conf * 100)}%</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(result.conf * 100)}%`, height: '100%', background: '#00ffaa', borderRadius: 3, transition: 'width 1s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>Error de validación: {result.cvPct.toFixed(1)}% de la diagonal</p>
          </div>
        </div>
      )}

      {/* Failure */}
      {failed && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 28px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(251,191,36,0.08)', border: '1.5px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, color: '#fbbf24' }}>↺</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Volvamos a intentarlo</p>
          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20, lineHeight: 1.5, maxWidth: 320 }}>
            Busca una posición cómoda, mantén el dispositivo estable y mira los puntos con naturalidad.
          </p>
          <button onClick={handleRetry} style={{ padding: '10px 26px', borderRadius: 12, background: 'rgba(0,113,227,0.15)', border: '1px solid rgba(0,113,227,0.3)', color: '#60aaff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Intentar de nuevo</button>
        </div>
      )}
    </div>
  );
};

export default ScreenCalibration;

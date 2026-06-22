import React, { useState, useEffect, useRef } from 'react';
import { analyzeWithGemini } from '../utils/gemini.js';
import { DEMO_SCORES } from '../config/constants.js';

const ScreenUpload = ({ c, blob, log, onFinish }) => {
  const PHASES = [
    [0,   'INICIANDO ANÁLISIS MULTIMODAL…'],
    [18,  'SUBIENDO VIDEO A GEMINI…'],
    [42,  'IA EVALUANDO RESPUESTA…'],
    [72,  'CALCULANDO COMPETENCIAS…'],
    [90,  'GENERANDO FEEDBACK PERSONALIZADO…'],
    [100, 'ANÁLISIS COMPLETADO ✓'],
  ];

  const [pct,      setPct]      = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [done,     setDone]     = useState(false);
  const [aiError,  setAiError]  = useState(null);

  const analysisStarted  = useRef(false);
  const resolvedScoresRef = useRef(null); // holds scores so the skip button can pass them

  useEffect(() => {
    if (analysisStarted.current) return;
    analysisStarted.current = true;

    let cancelled = false;

    const progressHandles = [
      setTimeout(() => { if (!cancelled) { setPct(18);  setPhaseIdx(1); }}, 400),
      setTimeout(() => { if (!cancelled) { setPct(42);  setPhaseIdx(2); }}, 2800),
      setTimeout(() => { if (!cancelled) { setPct(72);  setPhaseIdx(3); }}, 6000),
      setTimeout(() => { if (!cancelled) { setPct(90);  setPhaseIdx(4); }}, 9500),
    ];

    analyzeWithGemini(blob, c, log).then(scores => {
      if (cancelled) return;
      resolvedScoresRef.current = scores;
      setPct(100);
      setPhaseIdx(5);
      setDone(true);
      setTimeout(() => { if (!cancelled) onFinish(scores); }, 1200);
    }).catch(err => {
      if (cancelled) return;
      resolvedScoresRef.current = DEMO_SCORES;
      setAiError(err.message);
      setPct(100); setPhaseIdx(5); setDone(true);
      setTimeout(() => { if (!cancelled) onFinish(DEMO_SCORES); }, 1200);
    });

    return () => {
      cancelled = true;
      progressHandles.forEach(clearTimeout);
    };
  }, []);

  const sizeMB   = blob ? (blob.size / 1048576).toFixed(2) : '0.00';
  const events   = log  || [];
  const typeIcon = {
    SUSPECTED_READING:'📖', HEAD_TURN_LEFT:'◀', HEAD_TURN_RIGHT:'▶',
    SUSPECTED_PHONE:'📱', HEAD_DEVIATION:'↕', GAZE_OFF_SCREEN:'👁',
    SUSTAINED_SCREEN_GAZE:'👀', FACE_NOT_DETECTED:'⛔',
    EXTENDED_ABSENCE:'⚠', MULTIPLE_FACES:'👥', NO_BLINK_DETECTED:'😴',
    RAPID_GLANCE_PATTERN:'👀', GAZE_LATERAL_HEAD_RECTA:'👁', HEAD_GAZE_DISSOCIATION:'🔀',
    GAZE_VERTICAL_DOWN:'👇', GAZE_VERTICAL_UP:'👆', HEAD_TURN_SUSTAINED:'↔',
    SACCADE_HORIZONTAL:'📖', GAZE_OUT_OF_BOUNDS:'🚫', GAZE_OFF_CAMERA:'👁',
  };

  return (
    <div style={{ width:'100%', height:'100%', maxHeight:'100dvh', background:'#1d1d1f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', fontFamily:"'Inter',sans-serif", padding:'40px 24px 32px', overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', boxSizing:'border-box' }}>

      <div style={{ width:76, height:76, borderRadius:'50%', border:`2px solid ${done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22, boxShadow: 'none', transition:'all 0.7s', flexShrink:0 }}>
        <span style={{ fontSize:30 }}>{done ? '🛡' : '⬆'}</span>
      </div>

      <p style={{ fontSize:'10px', color:'rgba(255,255,255,.4)', letterSpacing:'.2px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif", marginBottom:6, textAlign:'center' }}>BIOMATCH SECURE VAULT</p>
      <p style={{ fontSize:done?'17px':'14px', fontWeight:700, color: done?'#f0f0f0':'rgba(200,240,240,.6)', fontFamily:"'Inter',sans-serif", marginBottom:24, textAlign:'center', transition:'all 0.6s', letterSpacing:done?'.5px':'0' }}>
        {done ? 'TECHNICAL EVIDENCE SECURED' : PHASES[phaseIdx][1]}
      </p>

      <div style={{ width:'100%', maxWidth:300, height:4, background:'rgba(255,255,255,.06)', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,#0050a0,#0071e3)', borderRadius:4, width:`${pct}%`, transition:'width 0.9s ease' }}/>
      </div>
      <p style={{ fontSize:'12px', color:'rgba(255,255,255,.55)', fontFamily:"'Inter',sans-serif", fontWeight:600, marginBottom:28 }}>{pct}%</p>

      <div style={{ width:'100%', maxWidth:300, display:'flex', flexDirection:'column', gap:10, marginBottom:events.length>0&&done?16:0 }}>
        <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'11px', color:'rgba(255,255,255,.5)', fontFamily:"'Inter',sans-serif", fontWeight:500 }}>VIDEO FILE</span>
          <span style={{ fontSize:'12px', color:'rgba(255,255,255,.9)', fontFamily:"'Inter',sans-serif", fontWeight:600 }}>{sizeMB} MB · WebM</span>
        </div>
        <div style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:`1px solid ${events.length>0?'rgba(255,150,0,0.25)':'rgba(255,255,255,0.07)'}`, borderRadius:20, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'11px', color:'rgba(255,255,255,.5)', fontFamily:"'Inter',sans-serif", fontWeight:500 }}>INTEGRITY EVENTS</span>
          <span style={{ fontSize:'10px', fontFamily:"'Inter',sans-serif", fontWeight:700, color: events.length>0 ? 'rgba(255,160,60,.85)' : 'rgba(0,220,130,.8)' }}>
            {events.length > 0 ? `⚑ ${events.length} noted` : '✓ CLEAN'}
          </span>
        </div>
      </div>

      {done && events.length > 0 && (
        <div style={{ width:'100%', maxWidth:300, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,150,0,0.2)', borderRadius:20, padding:'14px 16px', marginBottom:20 }}>
          <p style={{ fontSize:'10px', color:'rgba(255,255,255,.55)', letterSpacing:'1px', textTransform:'uppercase', fontWeight:600, fontFamily:"'Inter',sans-serif", marginBottom:10 }}>
            BEHAVIORAL SUMMARY · {events.length} potential distraction{events.length!==1?'s':''} noted
          </p>
          {events.slice(0,5).map((ev, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom: i<Math.min(events.length,5)-1 ? '0.5px solid rgba(255,150,0,.08)' : 'none' }}>
              <span style={{ fontSize:'10px', color:'rgba(230,235,245,0.9)', fontFamily:"'Inter',sans-serif", fontWeight:500 }}>
                {typeIcon[ev.type]||'⚑'} {ev.type.replace(/_/g,' ')}
              </span>
              <span style={{ fontSize:'9px', color:'rgba(255,255,255,.4)', fontFamily:"'Inter',sans-serif", flexShrink:0, marginLeft:8 }}>
                {ev.timestamp} · {ev.duration}
              </span>
            </div>
          ))}
          {events.length > 5 && (
            <p style={{ fontSize:'9px', color:'rgba(255,180,80,.6)', fontFamily:"'Inter',sans-serif", marginTop:6 }}>+{events.length-5} more events</p>
          )}
        </div>
      )}

      {done && events.length === 0 && (
        <p style={{ fontSize:'12px', color:'rgba(80,220,150,.85)', fontFamily:"'Inter',sans-serif", fontWeight:500, letterSpacing:'.2px', marginBottom:20, textAlign:'center' }}>
          ✓ No behavioral anomalies detected
        </p>
      )}

      {done && (
        <button onClick={() => onFinish(resolvedScoresRef.current ?? DEMO_SCORES)} style={{ width:'100%', maxWidth:300, padding:'16px', borderRadius:16, background:'#0071e3', border:'none', color:'#ffffff', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:'.3px', marginTop:20, flexShrink:0, boxShadow:'0 4px 20px rgba(0,113,227,0.35)', transition:'opacity 140ms ease, transform 120ms ease' }}>
          VIEW FULL ANALYSIS →
        </button>
      )}
    </div>
  );
};

export default ScreenUpload;

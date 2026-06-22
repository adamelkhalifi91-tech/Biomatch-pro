import React, { useState, useEffect } from 'react';
import { computeIntegrity, saveCandidateResult } from '../utils/supabase.js';
import { DEMO_MODE } from '../config/constants.js';

const ScreenResults = ({ c, captureData, aiScores, onReset }) => {
  const ANALYSIS_STEPS = [
    'Inicializando evaluación neural…',
    'Procesando respuesta técnica…',
    'Calculando vectores de comunicación…',
    'Verificando integridad biométrica…',
    'Generando Talent Passport…',
  ];
  const STEP_TIMINGS = [0, 1000, 2100, 3200, 4300];

  const TECH_SCORE  = aiScores?.technical_score ?? 80;
  const COMM_SCORES = {
    synthesis:  aiScores?.synthesis_score  ?? 78,
    confidence: aiScores?.confidence_score ?? 80,
    riskMgmt:   aiScores?.risk_mgmt_score  ?? 76,
  };
  const COMM_AVG = Math.round(Object.values(COMM_SCORES).reduce((a,b)=>a+b,0)/3);
  const AI_FEEDBACK     = aiScores?.feedback_summary || '';
  const AI_STRENGTHS    = aiScores?.strengths        || [];
  const AI_IMPROVEMENTS = aiScores?.improvements     || [];

  // Integrity must be computed here — before FINAL_SCORE — because it affects the grade.
  const log = captureData?.log || [];
  const { score: integrityRaw, status: integrityStatus, multiplier: integrityMult } = computeIntegrity(log);

  // Biometric multiplier is load-bearing: a review_required session cannot score high.
  // This makes the Scientific Trust Standard meaningful, not decorative.
  const rawScore  = aiScores?.final_score ?? Math.round(TECH_SCORE * 0.6 + COMM_AVG * 0.4);
  const FINAL_SCORE = Math.round(rawScore * integrityMult);

  const [phase,     setPhase]     = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
  const [barWidths, setBarWidths] = useState({ tech:0, synthesis:0, confidence:0, riskMgmt:0 });
  const [ringPct,   setRingPct]   = useState(0);
  const [saveStatus, setSaveStatus] = useState(null);
  const [passportSessionId, setPassportSessionId] = useState(null);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    const handles = STEP_TIMINGS.map((ms,i) => setTimeout(() => setPhase(i), ms));
    const doneHandle = setTimeout(() => {
      setAnalyzing(false);
      setTimeout(() => {
        setBarWidths({ tech:TECH_SCORE, synthesis:COMM_SCORES.synthesis,
          confidence:COMM_SCORES.confidence, riskMgmt:COMM_SCORES.riskMgmt });
        setRingPct(FINAL_SCORE);
      }, 120);
      const _sessionId = crypto.randomUUID();
      setPassportSessionId(_sessionId);
      setSaveStatus('saving');
      saveCandidateResult({
        captureData, challenge: c,
        scores: {
          _sessionId,
          final: FINAL_SCORE, raw_score: rawScore, integrity_mult: integrityMult,
          tech: TECH_SCORE, commAvg: COMM_AVG,
          synthesis: COMM_SCORES.synthesis, confidence: COMM_SCORES.confidence,
          riskMgmt: COMM_SCORES.riskMgmt,
          ai_feedback: AI_FEEDBACK, ai_strengths: AI_STRENGTHS, ai_improvements: AI_IMPROVEMENTS,
          scientific_field: aiScores?.scientific_field || c?.scientificField || '',
        },
      }).then(res => setSaveStatus(res.ok ? 'saved' : 'error'));
    }, 5000);
    return () => { handles.forEach(clearTimeout); clearTimeout(doneHandle); };
  }, []);

  const scoreLabel = (s) =>
    s >= 90 ? 'EXCEPCIONAL' : s >= 75 ? 'SÓLIDO' : s >= 60 ? 'COMPETENTE' : s >= 40 ? 'BÁSICO' : 'INSUFICIENTE';
  const scoreAccent = (s) =>
    s >= 75 ? '#34d399' : s >= 50 ? '#0071e3' : '#f87171';
  const integrityColor = integrityStatus === 'clean' ? '#34d399' : integrityStatus === 'warning' ? '#fbbf24' : '#f87171';
  const integrityLabel = integrityStatus === 'clean' ? 'VERIFICADO ✓' : integrityStatus === 'warning' ? 'ADVERTENCIA ⚑' : 'REVISIÓN REQUERIDA ⛔';

  const Ring = ({ pct, size=110, stroke=7, accent='#0071e3' }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} style={{ flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={accent} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (pct / 100) * circ}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1) .2s, stroke .4s' }}/>
      </svg>
    );
  };

  const Bar = ({ pct, accent='#0071e3' }) => (
    <div style={{ height:3, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden', marginTop:6 }}>
      <div style={{ height:'100%', borderRadius:3, background:accent,
        width:`${pct}%`, transition:'width 1.2s cubic-bezier(.16,1,.3,1) .3s' }}/>
    </div>
  );

  if (analyzing) return (
    <div style={{ height:'100%', background:'#1d1d1f', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:'0 32px' }}>
      <div style={{ position:'relative', width:88, height:88, marginBottom:36 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%',
          border:'1px solid rgba(0,113,227,.18)', animation:'scanPulse 2s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', inset:10, borderRadius:'50%',
          border:'1px solid rgba(0,113,227,.28)', animation:'scanPulse 2s ease-in-out infinite .4s' }}/>
        <div style={{ position:'absolute', inset:20, borderRadius:'50%',
          background:'rgba(0,113,227,0.10)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:20 }}>🧬</span>
        </div>
      </div>
      <p style={{ fontSize:'9px', color:'rgba(255,255,255,.25)', letterSpacing:'1.5px',
        fontFamily:"'Inter',sans-serif", marginBottom:12, textTransform:'uppercase' }}>
        BioMatch · AI Evaluation
      </p>
      <p style={{ fontSize:'14px', fontWeight:600, color:'rgba(255,255,255,.8)',
        fontFamily:"'Inter',sans-serif", textAlign:'center', marginBottom:32, minHeight:22 }}>
        {ANALYSIS_STEPS[phase]}
      </p>
      <div style={{ display:'flex', gap:7 }}>
        {ANALYSIS_STEPS.map((_,i) => (
          <div key={i} style={{ width: i===phase ? 18 : 6, height:6, borderRadius:3,
            background: i<=phase ? '#0071e3' : 'rgba(255,255,255,.1)',
            transition:'all .4s ease' }}/>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ height:'100%', background:'#1d1d1f', overflowY:'auto', overflowX:'hidden',
      WebkitOverflowScrolling:'touch', fontFamily:"'Inter',sans-serif" }}>

      <div style={{ position:'relative', padding:'28px 20px 24px', overflow:'hidden',
        borderBottom:'0.5px solid rgba(255,255,255,.06)' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse 80% 70% at 50% -10%, rgba(0,113,227,0.09) 0%, transparent 70%)' }}/>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8,
              background:'rgba(0,113,227,0.12)', border:'1px solid rgba(0,113,227,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:13 }}>🛡</span>
            </div>
            <div>
              <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,.3)',
                letterSpacing:'1.4px', textTransform:'uppercase' }}>Talent Passport</p>
              <p style={{ fontSize:'11px', fontWeight:600, color:'rgba(255,255,255,.7)', marginTop:1 }}>
                {c?.company || 'BioMatch'}
              </p>
            </div>
          </div>
          {!DEMO_MODE && saveStatus && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px',
              borderRadius:20, background:'rgba(255,255,255,.04)', border:'0.5px solid rgba(255,255,255,.08)' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
                background: saveStatus==='saved' ? '#34d399' : saveStatus==='error' ? '#f87171' : '#0071e3',
                animation: saveStatus==='saving' ? 'statusBlink 1s infinite' : 'none' }}/>
              <p style={{ fontSize:'8px', fontWeight:600, letterSpacing:'.5px',
                color: saveStatus==='saved' ? 'rgba(52,211,153,.7)' : saveStatus==='error' ? 'rgba(248,113,113,.7)' : 'rgba(0,113,227,.8)' }}>
                {saveStatus==='saving' ? 'SYNCING' : saveStatus==='saved' ? 'SYNCED ✓' : 'SYNC ERR'}
              </p>
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:18, position:'relative' }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <Ring pct={ringPct} size={110} stroke={7} accent={scoreAccent(FINAL_SCORE)}/>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:1 }}>
              <span style={{ fontSize:'26px', fontWeight:800, color:'#f5f5f7', lineHeight:1,
                fontFamily:"'Inter',sans-serif", letterSpacing:'-1px' }}>{ringPct}</span>
              <span style={{ fontSize:'9px', color:'rgba(255,255,255,.35)',
                fontFamily:"'Inter',sans-serif", letterSpacing:'.3px' }}>/100</span>
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,.3)', letterSpacing:'.8px',
              textTransform:'uppercase', marginBottom:4 }}>Score Global</p>
            <p style={{ fontSize:'22px', fontWeight:800, color: scoreAccent(FINAL_SCORE),
              letterSpacing:'-0.5px', lineHeight:1, marginBottom:6 }}>
              {scoreLabel(FINAL_SCORE)}
            </p>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,.45)', lineHeight:1.5,
              marginBottom:6 }}>{c?.role || 'Biotechnology Candidate'}</p>
            {(aiScores?.scientific_field || c?.scientificField) && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px',
                background:'rgba(0,113,227,0.10)', border:'0.5px solid rgba(0,113,227,0.22)',
                borderRadius:20, marginBottom:10 }}>
                <span style={{ fontSize:'9px', fontWeight:700, color:'rgba(0,113,227,0.8)',
                  letterSpacing:'0.5px', textTransform:'uppercase' }}>
                  {aiScores?.scientific_field || c?.scientificField}
                </span>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'8px', color:'rgba(255,255,255,.25)', letterSpacing:'.5px',
                  textTransform:'uppercase', marginBottom:2 }}>Técnico 60%</p>
                <p style={{ fontSize:'13px', fontWeight:700, color: scoreAccent(TECH_SCORE) }}>{TECH_SCORE}</p>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'8px', color:'rgba(255,255,255,.25)', letterSpacing:'.5px',
                  textTransform:'uppercase', marginBottom:2 }}>Comun. 40%</p>
                <p style={{ fontSize:'13px', fontWeight:700, color: scoreAccent(COMM_AVG) }}>{COMM_AVG}</p>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'8px', color:'rgba(255,255,255,.25)', letterSpacing:'.5px',
                  textTransform:'uppercase', marginBottom:2 }}>Integridad</p>
                <p style={{ fontSize:'13px', fontWeight:700, color: integrityColor }}>{integrityLabel.split(' ')[0]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 36px', display:'flex', flexDirection:'column', gap:10 }}>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>

          <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,.08)',
            borderRadius:22, padding:'16px 14px' }}>
            <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,.28)',
              letterSpacing:'1px', textTransform:'uppercase', marginBottom:10 }}>Técnico · 60%</p>
            <p style={{ fontSize:'28px', fontWeight:800, color: scoreAccent(TECH_SCORE),
              lineHeight:1, marginBottom:3 }}>{TECH_SCORE}</p>
            <p style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,.4)',
              marginBottom:8 }}>{scoreLabel(TECH_SCORE)}</p>
            <Bar pct={barWidths.tech} accent={scoreAccent(TECH_SCORE)}/>
          </div>

          <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,.08)',
            borderRadius:22, padding:'16px 14px' }}>
            <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,.28)',
              letterSpacing:'1px', textTransform:'uppercase', marginBottom:10 }}>Comun. · 40%</p>
            <p style={{ fontSize:'28px', fontWeight:800, color: scoreAccent(COMM_AVG),
              lineHeight:1, marginBottom:3 }}>{COMM_AVG}</p>
            <p style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,.4)',
              marginBottom:8 }}>{scoreLabel(COMM_AVG)}</p>
            <Bar pct={COMM_AVG} accent={scoreAccent(COMM_AVG)}/>
          </div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,.08)',
          borderRadius:22, padding:'16px 16px' }}>
          <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,.28)',
            letterSpacing:'1px', textTransform:'uppercase', marginBottom:14 }}>Vectores de Comunicación</p>
          {[
            { label:'Síntesis y claridad',     key:'synthesis',  pct: barWidths.synthesis  },
            { label:'Confianza vocal',          key:'confidence', pct: barWidths.confidence },
            { label:'Gestión de riesgo',        key:'riskMgmt',   pct: barWidths.riskMgmt   },
          ].map(({ label, key, pct }) => (
            <div key={key} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,.5)' }}>{label}</p>
                <p style={{ fontSize:'13px', fontWeight:700, color: scoreAccent(pct) }}>{pct}</p>
              </div>
              <Bar pct={pct} accent={scoreAccent(pct)}/>
            </div>
          ))}
        </div>

        {AI_FEEDBACK && (
          <div style={{ background:'rgba(0,113,227,0.06)', border:'0.5px solid rgba(0,113,227,.18)',
            borderRadius:22, padding:'18px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
              <div style={{ width:22, height:22, borderRadius:6,
                background:'rgba(0,113,227,0.15)', border:'0.5px solid rgba(0,113,227,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:11 }}>✦</span>
              </div>
              <p style={{ fontSize:'9px', fontWeight:700, color:'rgba(0,113,227,.7)',
                letterSpacing:'1px', textTransform:'uppercase' }}>CSO Evaluation · Gemini 2.0</p>
            </div>
            <p style={{ fontSize:'13px', lineHeight:1.75, color:'rgba(255,255,255,.8)',
              fontStyle:'italic', borderLeft:'2px solid rgba(0,113,227,0.4)',
              paddingLeft:12, marginLeft:2 }}>
              "{AI_FEEDBACK}"
            </p>
          </div>
        )}

        {(AI_STRENGTHS.length > 0 || AI_IMPROVEMENTS.length > 0) && (
          <div style={{ display:'grid',
            gridTemplateColumns: AI_STRENGTHS.length > 0 && AI_IMPROVEMENTS.length > 0 ? '1fr 1fr' : '1fr',
            gap:10 }}>

            {AI_STRENGTHS.length > 0 && (
              <div style={{ background:'rgba(52,211,153,0.05)', border:'0.5px solid rgba(52,211,153,.15)',
                borderRadius:22, padding:'16px 14px' }}>
                <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(52,211,153,.5)',
                  letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Fortalezas</p>
                {AI_STRENGTHS.map((s,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:9 }}>
                    <span style={{ fontSize:10, color:'#34d399', flexShrink:0, marginTop:2 }}>✓</span>
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,.72)', lineHeight:1.55, margin:0 }}>{s}</p>
                  </div>
                ))}
              </div>
            )}

            {AI_IMPROVEMENTS.length > 0 && (
              <div style={{ background:'rgba(251,191,36,0.05)', border:'0.5px solid rgba(251,191,36,.15)',
                borderRadius:22, padding:'16px 14px' }}>
                <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(251,191,36,.5)',
                  letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Mejoras</p>
                {AI_IMPROVEMENTS.map((s,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:9 }}>
                    <span style={{ fontSize:10, color:'#fbbf24', flexShrink:0, marginTop:2 }}>→</span>
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,.65)', lineHeight:1.55, margin:0 }}>{s}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: integrityStatus==='clean' ? 'rgba(52,211,153,0.05)' : integrityStatus==='warning' ? 'rgba(251,191,36,0.05)' : 'rgba(248,113,113,0.05)',
          border:`0.5px solid ${integrityStatus==='clean' ? 'rgba(52,211,153,.18)' : integrityStatus==='warning' ? 'rgba(251,191,36,.18)' : 'rgba(248,113,113,.18)'}`,
          borderRadius:22, padding:'16px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: log.length > 0 ? 14 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: integrityColor,
                animation: integrityStatus!=='clean' ? 'statusBlink 1.5s infinite' : 'none' }}/>
              <p style={{ fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,.3)',
                letterSpacing:'1px', textTransform:'uppercase' }}>Auditoría Biométrica</p>
            </div>
            <div style={{ padding:'3px 10px', borderRadius:20,
              background: integrityStatus==='clean' ? 'rgba(52,211,153,.1)' : integrityStatus==='warning' ? 'rgba(251,191,36,.1)' : 'rgba(248,113,113,.1)',
              border:`0.5px solid ${integrityColor}44` }}>
              <p style={{ fontSize:'8px', fontWeight:700, letterSpacing:'.5px', color: integrityColor }}>
                {integrityLabel}
              </p>
            </div>
          </div>
          {log.length === 0 ? null : (
            <div>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.35)', marginBottom:10 }}>
                {log.length} evento{log.length!==1?'s':''} registrado{log.length!==1?'s':''}
              </p>
              {log.slice(0,4).map((ev,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'6px 0', borderBottom: i < Math.min(log.length,4)-1 ? `0.5px solid ${integrityColor}18` : 'none' }}>
                  <p style={{ fontSize:'10px', color:'rgba(255,255,255,.45)' }}>
                    {ev.type?.replace(/_/g,' ')}
                  </p>
                  <p style={{ fontSize:'9px', color:'rgba(255,255,255,.25)' }}>
                    {ev.timestamp} · {ev.duration}
                  </p>
                </div>
              ))}
              {log.length > 4 && (
                <p style={{ fontSize:'9px', color:'rgba(0,113,227,.4)', marginTop:8 }}>
                  +{log.length-4} eventos más
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[
            ['Protocolo',  'ONE-SHOT'],
            ['Duración',   '2:00 MIN'],
            ['Motor IA',   'v2.4 CSO'],
          ].map(([k,v]) => (
            <div key={k} style={{ background:'rgba(255,255,255,0.03)',
              border:'0.5px solid rgba(255,255,255,.06)', borderRadius:14, padding:'10px 12px',
              textAlign:'center' }}>
              <p style={{ fontSize:'8px', color:'rgba(255,255,255,.25)', letterSpacing:'.8px',
                textTransform:'uppercase', marginBottom:4 }}>{k}</p>
              <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,.55)' }}>{v}</p>
            </div>
          ))}
        </div>

        {passportSessionId && saveStatus === 'saved' && (() => {
          const passportUrl = `${window.location.origin}${window.location.pathname}?passport=${passportSessionId}`;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(passportUrl)}&bgcolor=1d1d1f&color=f5f5f7&margin=12`;
          const handleCopy = () => {
            navigator.clipboard.writeText(passportUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            });
          };
          return (
            <div style={{ background:'rgba(0,113,227,0.06)', border:'0.5px solid rgba(0,113,227,0.18)',
              borderRadius:22, padding:'18px 18px' }}>
              <p style={{ fontSize:9, fontWeight:700, color:'rgba(0,113,227,0.6)',
                letterSpacing:'1px', textTransform:'uppercase', marginBottom:14 }}>
                Compartir Talent Passport
              </p>
              <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:14 }}>
                <img src={qrSrc} alt="QR Passport"
                  style={{ width:80, height:80, borderRadius:10, flexShrink:0,
                    border:'0.5px solid rgba(255,255,255,0.1)' }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.5 }}>
                    Cualquier persona con este enlace puede ver tu Talent Passport.
                  </p>
                  <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)',
                    borderRadius:10, padding:'8px 10px', fontSize:10,
                    color:'rgba(255,255,255,0.35)', wordBreak:'break-all',
                    fontFamily:"'JetBrains Mono', monospace", lineHeight:1.5 }}>
                    {passportUrl.replace('https://','')}
                  </div>
                </div>
              </div>
              <button onClick={handleCopy}
                style={{ width:'100%', padding:'12px', borderRadius:14, border:'none',
                  fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 180ms ease',
                  background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(0,113,227,0.15)',
                  color: copied ? '#34d399' : '#60aaff' }}>
                {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
              </button>
            </div>
          );
        })()}

        <button onClick={onReset}
          style={{ width:'100%', padding:'16px', borderRadius:18,
            background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,.09)',
            color:'rgba(255,255,255,.6)', fontSize:'14px', fontWeight:600, cursor:'pointer',
            letterSpacing:'.2px', transition:'background 140ms ease, transform 120ms ease',
            marginTop:4 }}>
          ← Volver a Challenges
        </button>
      </div>
    </div>
  );
};

export default ScreenResults;

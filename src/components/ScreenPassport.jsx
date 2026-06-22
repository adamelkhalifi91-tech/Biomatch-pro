import React, { useState, useEffect } from 'react';
import { getSupabase } from '../utils/supabase.js';

const ScreenPassport = ({ sessionId }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const db = getSupabase();
    if (!db) { setError('Supabase no configurado.'); setLoading(false); return; }
    db.from('candidates')
      .select('*')
      .eq('session_id', sessionId)
      .single()
      .then(({ data: row, error: err }) => {
        if (err || !row) setError('Pasaporte no encontrado o expirado.');
        else setData(row);
        setLoading(false);
      });
  }, [sessionId]);

  const clamp  = v => Math.max(0, Math.min(100, Math.round(v || 0)));
  const accent = s => s >= 75 ? '#34d399' : s >= 50 ? '#0071e3' : '#f87171';
  const label  = s => s >= 90 ? 'EXCEPCIONAL' : s >= 75 ? 'SÓLIDO' : s >= 60 ? 'COMPETENTE' : s >= 40 ? 'BÁSICO' : 'INSUFICIENTE';

  const Ring = ({ pct, size=100, stroke=6, color='#0071e3' }) => {
    const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} style={{ flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - (pct/100)*circ}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }}/>
      </svg>
    );
  };

  const Bar = ({ pct, color }) => (
    <div style={{ height:3, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden', marginTop:5 }}>
      <div style={{ height:'100%', borderRadius:3, background:color, width:`${pct}%`,
        transition:'width 1.2s cubic-bezier(.16,1,.3,1)' }}/>
    </div>
  );

  if (loading) return (
    <div style={{ height:'100vh', background:'#1d1d1f', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ fontSize:28, marginBottom:16 }}>🧬</div>
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>Cargando Talent Passport…</p>
    </div>
  );

  if (error) return (
    <div style={{ height:'100vh', background:'#1d1d1f', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:32, fontFamily:"'Inter',sans-serif" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>🔒</div>
      <p style={{ fontSize:15, fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>Pasaporte no encontrado</p>
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', textAlign:'center' }}>{error}</p>
    </div>
  );

  const fs  = clamp(data.final_score);
  const ts  = clamp(data.technical_score);
  const syn = clamp(data.comm_synthesis);
  const con = clamp(data.comm_confidence);
  const rsk = clamp(data.comm_risk_mgmt);
  const commAvg = Math.round((syn + con + rsk) / 3);
  const intColor = data.integrity_status === 'clean' ? '#34d399' : data.integrity_status === 'warning' ? '#fbbf24' : '#f87171';
  const intLabel = data.integrity_status === 'clean' ? 'VERIFICADO ✓' : data.integrity_status === 'warning' ? 'ADVERTENCIA ⚑' : 'REVISIÓN ⛔';
  const strengths    = Array.isArray(data.ai_strengths)    ? data.ai_strengths    : [];
  const improvements = Array.isArray(data.ai_improvements) ? data.ai_improvements : [];

  return (
    <div style={{ minHeight:'100vh', background:'#1d1d1f', fontFamily:"'Inter',sans-serif", overflowX:'hidden' }}>

      <div style={{ background:'rgba(0,113,227,0.08)', borderBottom:'0.5px solid rgba(0,113,227,0.15)',
        padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span style={{ fontSize:11 }}>🛡</span>
        <p style={{ fontSize:11, fontWeight:600, color:'rgba(0,113,227,0.8)', letterSpacing:'0.5px' }}>
          Talent Passport verificado por BioMatch · Evaluación con IA y seguimiento biométrico
        </p>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'28px 16px 48px' }}>

        <div style={{ marginBottom:20 }}>
          <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)',
            letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:4 }}>BioMatch · Talent Passport</p>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#f5f5f7', letterSpacing:'-0.3px', marginBottom:6 }}>
            {data.challenge_title}
          </h1>
          {data.scientific_field && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px',
              background:'rgba(0,113,227,0.10)', border:'0.5px solid rgba(0,113,227,0.22)',
              borderRadius:20, marginBottom:6 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(0,113,227,0.8)',
                letterSpacing:'0.5px', textTransform:'uppercase' }}>{data.scientific_field}</span>
            </div>
          )}
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>
            {new Date(data.created_at).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>

        <div style={{ border:'0.5px solid rgba(255,255,255,0.08)',
          borderRadius:24, padding:'20px 18px', marginBottom:10,
          background:'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,113,227,0.08) 0%, rgba(29,29,31,0.04) 70%)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <Ring pct={fs} size={100} stroke={6} color={accent(fs)}/>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:22, fontWeight:800, color:'#f5f5f7', lineHeight:1 }}>{fs}</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>/100</span>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.8px',
                textTransform:'uppercase', marginBottom:3 }}>Score Global</p>
              <p style={{ fontSize:20, fontWeight:800, color:accent(fs),
                letterSpacing:'-0.5px', lineHeight:1, marginBottom:8 }}>{label(fs)}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['Técnico 60%', ts, accent(ts)],['Comun. 40%', commAvg, accent(commAvg)]].map(([l,v,c]) => (
                  <div key={l}>
                    <p style={{ fontSize:8, color:'rgba(255,255,255,0.22)', textTransform:'uppercase',
                      letterSpacing:'0.5px', marginBottom:2 }}>{l}</p>
                    <p style={{ fontSize:15, fontWeight:700, color:c }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)',
          borderRadius:22, padding:'16px 16px', marginBottom:10 }}>
          <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)',
            letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:12 }}>Vectores de comunicación</p>
          {[['Síntesis', syn],['Confianza vocal', con],['Gestión de riesgo', rsk]].map(([l,v]) => (
            <div key={l} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{l}</p>
                <p style={{ fontSize:12, fontWeight:700, color:accent(v) }}>{v}</p>
              </div>
              <Bar pct={v} color={accent(v)}/>
            </div>
          ))}
        </div>

        {data.ai_feedback && (
          <div style={{ background:'rgba(0,113,227,0.06)', border:'0.5px solid rgba(0,113,227,0.18)',
            borderRadius:22, padding:'16px 16px', marginBottom:10 }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(0,113,227,0.6)',
              letterSpacing:'1px', textTransform:'uppercase', marginBottom:10 }}>✦ CSO Evaluation · Gemini 2.0</p>
            <p style={{ fontSize:12, lineHeight:1.75, color:'rgba(255,255,255,0.75)',
              fontStyle:'italic', borderLeft:'2px solid rgba(0,113,227,0.4)', paddingLeft:10 }}>
              "{data.ai_feedback}"
            </p>
          </div>
        )}

        {(strengths.length > 0 || improvements.length > 0) && (
          <div style={{ display:'grid', gridTemplateColumns: strengths.length && improvements.length ? '1fr 1fr' : '1fr',
            gap:10, marginBottom:10 }}>
            {strengths.length > 0 && (
              <div style={{ background:'rgba(52,211,153,0.05)', border:'0.5px solid rgba(52,211,153,0.15)',
                borderRadius:20, padding:'14px 12px' }}>
                <p style={{ fontSize:8, fontWeight:700, color:'rgba(52,211,153,0.5)',
                  letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:10 }}>Fortalezas</p>
                {strengths.map((s,i) => (
                  <div key={i} style={{ display:'flex', gap:6, marginBottom:7 }}>
                    <span style={{ color:'#34d399', flexShrink:0, fontSize:10, marginTop:2 }}>✓</span>
                    <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:1.5 }}>{s}</p>
                  </div>
                ))}
              </div>
            )}
            {improvements.length > 0 && (
              <div style={{ background:'rgba(251,191,36,0.05)', border:'0.5px solid rgba(251,191,36,0.15)',
                borderRadius:20, padding:'14px 12px' }}>
                <p style={{ fontSize:8, fontWeight:700, color:'rgba(251,191,36,0.5)',
                  letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:10 }}>Mejoras</p>
                {improvements.map((s,i) => (
                  <div key={i} style={{ display:'flex', gap:6, marginBottom:7 }}>
                    <span style={{ color:'#fbbf24', flexShrink:0, fontSize:10, marginTop:2 }}>→</span>
                    <p style={{ fontSize:11, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>{s}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background:`rgba(${data.integrity_status==='clean'?'52,211,153':data.integrity_status==='warning'?'251,191,36':'248,113,113'},0.05)`,
          border:`0.5px solid ${intColor}33`, borderRadius:20, padding:'14px 16px', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:intColor }}/>
              <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)',
                letterSpacing:'0.8px', textTransform:'uppercase' }}>Auditoría Biométrica</p>
            </div>
            <div style={{ padding:'3px 10px', borderRadius:20,
              background:`${intColor}18`, border:`0.5px solid ${intColor}44` }}>
              <p style={{ fontSize:8, fontWeight:700, color:intColor, letterSpacing:'0.5px' }}>{intLabel}</p>
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[['Protocolo','ONE-SHOT'],['Motor IA','v2.4 CSO'],['Verificado','BioMatch']].map(([k,v]) => (
            <div key={k} style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)',
              borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
              <p style={{ fontSize:8, color:'rgba(255,255,255,0.22)', textTransform:'uppercase',
                letterSpacing:'0.6px', marginBottom:4 }}>{k}</p>
              <p style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{v}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ScreenPassport;

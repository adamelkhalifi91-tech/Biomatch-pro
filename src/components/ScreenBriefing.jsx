import React, { useState } from 'react';

const ScreenBriefing = ({ c, onContinue, onBack }) => {
  const [accepted, setAccepted] = useState(false);

  const sections = [
    {
      icon: '🎯',
      title: 'Una sola oportunidad',
      body: 'Tendrás 60 segundos para prepararte y 120 segundos para responder. No hay pausas ni repeticiones. Esto no es un obstáculo — es lo que garantiza que lo que veas en el resultado refleje tu capacidad real.',
    },
    {
      icon: '👁',
      title: 'Seguimiento ocular activo',
      body: 'El sistema registra la dirección de tu mirada durante toda la sesión. No necesitas mirar fijamente a la cámara — habla con naturalidad. Lo que sí detectamos: leer de un guion, consultar un monitor externo o notas fuera de cuadro.',
    },
    {
      icon: '🧠',
      title: 'Evaluación por IA',
      body: 'Tu respuesta será analizada por un modelo configurado como Chief Scientific Officer. Evalúa rigor técnico (60%) y claridad comunicativa (40%). La IA detecta automáticamente respuestas generadas o memorizadas sin comprensión.',
    },
    {
      icon: '🔒',
      title: 'Sin trampa posible',
      body: 'La combinación de seguimiento biométrico en tiempo real y análisis de IA hace que leer un guion o usar ayuda externa resulte en una penalización drástica — peor resultado que responder con honestidad sobre lo que sabes.',
    },
    {
      icon: '✦',
      title: 'Tu mejor versión',
      body: 'El sistema está diseñado para que quien realmente sabe, destaque. No buscamos perfección — buscamos pensamiento científico genuino. Respira, habla como lo harías con un colega, y deja que tu conocimiento hable.',
    },
  ];

  return (
    <div style={{ height:'100%', background:'#1d1d1f', overflowY:'auto',
      fontFamily:"'Inter',sans-serif", WebkitOverflowScrolling:'touch' }}>

      <div style={{ padding:'52px 24px 0' }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
          color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer',
          display:'flex', alignItems:'center', gap:6, marginBottom:24, padding:0 }}>
          ← Volver
        </button>
        <p style={{ fontSize:9, fontWeight:700, color:'rgba(0,113,227,0.6)',
          letterSpacing:'1.4px', textTransform:'uppercase', marginBottom:8 }}>
          Antes de empezar
        </p>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#f5f5f7',
          letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }}>
          Cómo funciona BioMatch
        </h1>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.6, marginBottom:32 }}>
          Para <strong style={{ color:'rgba(255,255,255,0.65)' }}>{c?.role}</strong> en {c?.company}
        </p>
      </div>

      <div style={{ padding:'0 16px 40px', display:'flex', flexDirection:'column', gap:10 }}>

        {sections.map(({ icon, title, body }, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.04)',
            border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:22,
            padding:'18px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background:'rgba(0,113,227,0.10)', border:'0.5px solid rgba(0,113,227,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
              {icon}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'#f0f0f0', marginBottom:5 }}>{title}</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>{body}</p>
            </div>
          </div>
        ))}

        <div onClick={() => setAccepted(v => !v)}
          style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'16px 18px',
            background: accepted ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
            border: `0.5px solid ${accepted ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius:18, cursor:'pointer', transition:'all 200ms ease', marginTop:4 }}>
          <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
            background: accepted ? '#34d399' : 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${accepted ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 200ms ease' }}>
            {accepted && <span style={{ fontSize:11, color:'#1d1d1f', fontWeight:700 }}>✓</span>}
          </div>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.65 }}>
            Entiendo que esta sesión incluye seguimiento biométrico y evaluación por IA,
            y acepto participar bajo estas condiciones.
          </p>
        </div>

        <button onClick={onContinue} disabled={!accepted}
          style={{ width:'100%', padding:'16px', borderRadius:18, border:'none',
            fontSize:14, fontWeight:700, letterSpacing:'0.1px', cursor: accepted ? 'pointer' : 'not-allowed',
            background: accepted ? '#0071e3' : 'rgba(255,255,255,0.06)',
            color: accepted ? '#fff' : 'rgba(255,255,255,0.2)',
            transition:'all 200ms ease', marginTop:4 }}>
          Comenzar calibración →
        </button>

      </div>
    </div>
  );
};

export default ScreenBriefing;

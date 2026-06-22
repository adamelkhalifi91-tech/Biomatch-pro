import React from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
} from 'chart.js';
import { getSupabase } from '../utils/supabase.js';
import { ChevronLeft, ShieldCheck, ShieldAlert, PlayIcon, BrainIcon, GridDotsAvatar } from './icons/Icons.jsx';

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip);

const CeoScoreBar = ({ label, pct, weight, color = '#0071e3', animate }) => {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (animate) { const t = setTimeout(() => setW(pct), 80); return () => clearTimeout(t); }
    else setW(pct);
  }, [animate, pct]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:500 }}>{label}</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:9, color:'rgba(255,255,255,.25)', letterSpacing:'.5px' }}>{weight}%</span>
          <span style={{ fontSize:12, fontWeight:700, color }}>{pct}</span>
        </div>
      </div>
      <div style={{ background:'rgba(255,255,255,.06)', borderRadius:99, height:4, overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:99, width:`${w}%`,
          background:`linear-gradient(90deg,${color}99,${color})`,
          transition:'width 1.2s cubic-bezier(.16,1,.3,1)',
        }}/>
      </div>
    </div>
  );
};

const IntegrityBadge = ({ status }) => {
  const clean = status === 'clean';
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px', borderRadius:8, fontSize:10, fontWeight:700, letterSpacing:'.3px',
      color:      clean ? 'rgba(80,220,150,.9)'    : 'rgba(255,170,60,.9)',
      background: clean ? 'rgba(0,200,100,.08)'    : 'rgba(255,150,0,.08)',
      border:    `1px solid ${clean ? 'rgba(0,200,100,.2)' : 'rgba(255,150,0,.2)'}`,
      flexShrink: 0,
    }}>
      <span style={{ color: clean ? 'rgba(80,220,150,.9)' : 'rgba(255,170,60,.9)' }}>
        {clean ? <ShieldCheck/> : <ShieldAlert/>}
      </span>
      {clean ? 'CLEAN' : 'REVIEW'}
    </div>
  );
};

const MiniRing = ({ pct }) => {
  const r = 18, circ = 2 * Math.PI * r;
  const color = pct >= 90 ? '#34d399' : pct >= 80 ? '#0071e3' : '#f59e0b';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="3.5"/>
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (pct/100)*circ}
        transform="rotate(-90 22 22)"/>
      <text x="22" y="26" textAnchor="middle" fill={color}
        fontSize="11" fontWeight="700" fontFamily="Inter,sans-serif">{pct}</text>
    </svg>
  );
};

const ScreenCEODashboard = ({ onBack }) => {

  const [candidates, setCandidates] = React.useState([]);
  const [isLoading,  setIsLoading]  = React.useState(true);
  const [fetchError, setFetchError] = React.useState(null);
  const [passportId, setPassportId] = React.useState(null);
  const [revealed,   setRevealed]   = React.useState(false);
  const [barAnimate, setBarAnimate] = React.useState(false);
  const [sortKey,    setSortKey]    = React.useState('globalScore');

  const chartRef      = React.useRef(null);
  const chartInstance = React.useRef(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchCandidates = async () => {
      setIsLoading(true);
      setFetchError(null);

      const db = getSupabase();
      if (!db) {
        if (isMounted) { setCandidates([]); setIsLoading(false); }
        return;
      }

      const { data, error } = await db
        .from('candidates')
        .select('id, session_id, final_score, technical_score, comm_avg, comm_synthesis, comm_confidence, comm_risk_mgmt, integrity_status, integrity_events, challenge_title, video_url, created_at, blob_size_kb, ai_feedback, ai_strengths, ai_improvements, scientific_field')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('BioMatch Supabase error:', error);
        setFetchError(error.message);
        setIsLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row, idx) => {
  const techScore  = Number(row.technical_score)  || 0;
  const synthesis  = Number(row.comm_synthesis)   || Number(row.comm_avg) || 0;
  const confidence = Number(row.comm_confidence)  || Number(row.comm_avg) || 0;
  const riskMgmt   = Number(row.comm_risk_mgmt)    || Number(row.comm_avg) || 0;
  const commScore  = Math.round((synthesis + confidence + riskMgmt) / 3);

  const globalScore = Number(row.final_score) ||
    Math.round(techScore * 0.6 + commScore * 0.4);

  const rawStatus   = String(row.integrity_status ?? '').toLowerCase();
  const badgeStatus = rawStatus === 'clean' ? 'clean' : 'flagged';
  const events      = Array.isArray(row.integrity_events) ? row.integrity_events : [];

  return {
    anonId:          `BIO-${String(idx + 1).padStart(3, '0')}`,
    realName:        '— Confidential —',
    globalScore,
    techScore,
    commScore,
    commDetail:      { synthesis, confidence, riskMgmt },
    integrityStatus: badgeStatus,
    integrityEvents: events,
    challengeTitle:  row.challenge_title  ?? 'Unnamed Challenge',
    videoUrl:        row.video_url        ?? null,
    blobSizeKb:      Number(row.blob_size_kb) || 0,
    createdAt:       row.created_at,
    aiFeedback:      '',
  };
});

      setCandidates(mapped);
      setIsLoading(false);
    };

    fetchCandidates();
    return () => { isMounted = false; };
  }, []);

  React.useEffect(() => {
    if (!chartRef.current || candidates.length === 0) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const scoreBuckets = [0,0,0,0,0];
    candidates.forEach(c => {
      const i = Math.min(Math.floor(c.globalScore/20), 4);
      scoreBuckets[i]++;
    });
    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: ['0–19','20–39','40–59','60–79','80–100'],
        datasets: [{
          data: scoreBuckets,
          backgroundColor: [
            'rgba(248,113,113,0.7)',
            'rgba(251,191,36,0.7)',
            'rgba(96,170,255,0.7)',
            'rgba(0,113,227,0.8)',
            'rgba(52,211,153,0.8)',
          ],
          borderColor: 'transparent',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw} candidato${ctx.raw!==1?'s':''}` }
        }},
        scales: {
          x: { grid: { color:'rgba(255,255,255,0.04)' }, ticks: { color:'rgba(255,255,255,0.35)', font:{size:10} } },
          y: { grid: { color:'rgba(255,255,255,0.04)' }, ticks: { color:'rgba(255,255,255,0.35)', font:{size:10}, stepSize:1 }, beginAtZero:true },
        },
      },
    });
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [candidates.length]);

  const sorted   = [...candidates].sort((a, b) => b[sortKey] - a[sortKey]);
  const selected = candidates.find(c => c.anonId === passportId);

  const openPassport = (id) => {
    setPassportId(id);
    setRevealed(false);
    setBarAnimate(false);
    setTimeout(() => setRevealed(true),  320);
    setTimeout(() => setBarAnimate(true), 480);
  };
  const closePassport = () => { setPassportId(null); setRevealed(false); };

  const bento = (extra = {}) => ({
    background:           'rgba(255,255,255,0.05)',
    backdropFilter:       'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border:               '1px solid rgba(255,255,255,0.08)',
    borderRadius:          28,
    padding:               22,
    ...extra,
  });

  if (isLoading) return (
    <div style={{
      height:'100%', background:'#1d1d1f', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:'Inter,sans-serif',
    }}>
      <style>{`@keyframes _ceo_spin { to { transform:rotate(360deg); } }`}</style>
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:16,
        background:'rgba(255,255,255,0.04)',
        backdropFilter:'blur(30px)', WebkitBackdropFilter:'blur(30px)',
        border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:28, padding:'36px 48px',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44"
          style={{ animation:'_ceo_spin 1s linear infinite' }}>
          <circle cx="22" cy="22" r="18" fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="3.5"/>
          <circle cx="22" cy="22" r="18" fill="none" stroke="#0071e3"
            strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray="113" strokeDashoffset="85"
            transform="rotate(-90 22 22)"/>
        </svg>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'#f5f5f7', marginBottom:4, letterSpacing:'-.2px' }}>
            Loading Candidate Data
          </p>
          <p style={{ fontSize:11, color:'#86868b', letterSpacing:'.3px' }}>
            Connecting to Supabase…
          </p>
        </div>
      </div>
    </div>
  );

  if (fetchError) return (
    <div style={{
      height:'100%', background:'#1d1d1f', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'0 24px', fontFamily:'Inter,sans-serif',
    }}>
      <div style={{ ...bento(), maxWidth:340, textAlign:'center', border:'1px solid rgba(255,80,80,0.2)' }}>
        <p style={{ fontSize:28, marginBottom:12 }}>⚠️</p>
        <p style={{ fontSize:14, fontWeight:700, color:'#f5f5f7', marginBottom:8 }}>Connection Error</p>
        <p style={{ fontSize:12, color:'#86868b', lineHeight:1.6, marginBottom:20 }}>{fetchError}</p>
        <button onClick={onBack} style={{
          width:'100%', padding:12, borderRadius:14,
          background:'rgba(0,113,227,0.12)', border:'1px solid rgba(0,113,227,0.35)',
          color:'#60aaff', fontSize:13, fontWeight:600, cursor:'pointer',
        }}>Go Back</button>
      </div>
    </div>
  );

  if (selected) return (
    <div style={{
      height:'100%', background:'#1d1d1f', overflowY:'auto',
      overflowX:'hidden', WebkitOverflowScrolling:'touch',
      fontFamily:'Inter,sans-serif',
    }}>
      <div style={{
        position:'sticky', top:0, zIndex:10,
        padding:'44px 20px 14px',
        background:'linear-gradient(180deg,#1d1d1f 82%,transparent)',
        display:'flex', alignItems:'center', gap:10,
      }}>
        <button onClick={closePassport} style={{
          display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
          borderRadius:14, background:'rgba(255,255,255,0.06)',
          border:'1px solid rgba(255,255,255,0.09)',
          color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600,
          cursor:'pointer', lineHeight:1,
        }}>
          <ChevronLeft/> Leaderboard
        </button>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.25)', letterSpacing:'.5px', textTransform:'uppercase' }}>
          {selected.anonId} — Talent Passport
        </span>
      </div>

      <div style={{ padding:'4px 16px 48px', display:'flex', flexDirection:'column', gap:14 }}>

        <div style={{ ...bento(), overflow:'hidden', padding:'20px 22px' }}>
          <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:10 }}>
            Verified Candidate
          </p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h2 style={{
                fontSize:24, fontWeight:800,
                color: revealed ? '#f5f5f7' : 'transparent',
                letterSpacing:'-.4px', lineHeight:1.2,
                filter: revealed ? 'none' : 'blur(14px)',
                transition:'all .6s cubic-bezier(.16,1,.3,1)', userSelect:'none',
              }}>
                {selected.realName}
              </h2>
              <p style={{ fontSize:13, color:'#86868b', marginTop:4 }}>{selected.challengeTitle}</p>
              {selected.createdAt && (
                <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:3 }}>
                  {new Date(selected.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  {selected.blobSizeKb > 0 && ` · ${(selected.blobSizeKb/1024).toFixed(2)} MB`}
                </p>
              )}
            </div>
            <MiniRing pct={selected.globalScore}/>
          </div>
        </div>

        <div style={{ ...bento(), padding:0, overflow:'hidden' }}>
          {selected.videoUrl ? (
            <video src={selected.videoUrl} controls playsInline
              style={{ width:'100%', aspectRatio:'9/16', background:'#000', display:'block', borderRadius:28 }}
            />
          ) : (
            <div style={{
              aspectRatio:'9/16', background:'rgba(0,0,0,0.6)', minHeight:200,
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', position:'relative',
            }}>
              <div style={{
                position:'absolute', inset:0,
                background:'repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0px,rgba(255,255,255,.015) 1px,transparent 1px,transparent 4px)',
                pointerEvents:'none',
              }}/>
              <div style={{
                width:48, height:48, borderRadius:'50%',
                background:'rgba(0,113,227,0.15)', border:'1px solid rgba(0,113,227,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'rgba(0,113,227,.85)', marginBottom:12,
              }}>
                <PlayIcon/>
              </div>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.4)', letterSpacing:'.5px', textTransform:'uppercase', textAlign:'center' }}>
                One-Shot Recording
              </p>
              <p style={{ fontSize:9, color:'rgba(255,255,255,.2)', marginTop:4 }}>No video URL in database</p>
            </div>
          )}
          <div style={{ padding:'12px 16px' }}>
            <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:2 }}>Evidence</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontWeight:600 }}>{selected.challengeTitle}</p>
          </div>
        </div>

        <div style={{ ...bento() }}>
          <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:16 }}>
            60/40 Evaluation
          </p>
          <CeoScoreBar label="Technical Proficiency" pct={selected.techScore}            weight={60} animate={barAnimate}/>
          <div style={{ height:1, background:'rgba(255,255,255,.05)', margin:'14px 0' }}/>
          <p style={{ fontSize:9, color:'rgba(255,255,255,.25)', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:12 }}>
            Communication Vectors
          </p>
          <CeoScoreBar label="Synthesis"  pct={selected.commDetail.synthesis}  weight={13} color="#60aaff" animate={barAnimate}/>
          <CeoScoreBar label="Confidence" pct={selected.commDetail.confidence} weight={14} color="#60aaff" animate={barAnimate}/>
          <CeoScoreBar label="Risk Mgmt"  pct={selected.commDetail.riskMgmt}   weight={13} color="#60aaff" animate={barAnimate}/>
        </div>

        <div style={{
          ...bento(),
          border: selected.integrityStatus === 'clean'
            ? '1px solid rgba(0,200,100,.14)'
            : '1px solid rgba(255,150,0,.2)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'1px', textTransform:'uppercase' }}>
              FaceMesh 4 FPS — Integrity Audit
            </p>
            <IntegrityBadge status={selected.integrityStatus}/>
          </div>
          {selected.integrityStatus === 'clean' ? (
            <div style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 14px', background:'rgba(0,200,100,.06)',
              borderRadius:14, border:'1px solid rgba(0,200,100,.12)',
            }}>
              <span style={{ fontSize:16 }}>✓</span>
              <div>
                <p style={{ fontSize:12, fontWeight:600, color:'rgba(80,220,150,.9)' }}>Auditoría Verificada</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>No anomalies detected during recording session.</p>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:11, color:'rgba(255,170,60,.6)', marginBottom:10 }}>
                {selected.integrityEvents.length} behavioral event{selected.integrityEvents.length !== 1 ? 's' : ''} flagged
              </p>
              {selected.integrityEvents.map((ev, i) => (
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'9px 12px', marginBottom:6, borderRadius:12,
                  background:'rgba(255,150,0,.06)', border:'1px solid rgba(255,150,0,.12)',
                }}>
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:'rgba(255,200,100,.9)' }}>{ev.type}</p>
                    <p style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:2 }}>{ev.timestamp}</p>
                  </div>
                  <span style={{
                    fontSize:10, fontWeight:700, color:'rgba(255,160,60,.8)',
                    background:'rgba(255,150,0,.1)', border:'1px solid rgba(255,150,0,.2)',
                    borderRadius:6, padding:'2px 8px',
                  }}>{ev.duration}</span>
                </div>
              ))}
              {selected.integrityEvents.length === 0 && (
                <p style={{ fontSize:10, color:'rgba(255,255,255,.2)' }}>
                  Event detail available only for locally-recorded sessions.
                </p>
              )}
            </div>
          )}
        </div>

        {selected.aiFeedback ? (
          <div style={{ ...bento(), border:'1px solid rgba(0,113,227,.14)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <div style={{
                width:26, height:26, borderRadius:8,
                background:'rgba(0,113,227,.12)', border:'1px solid rgba(0,113,227,.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><BrainIcon/></div>
              <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'1.2px', textTransform:'uppercase' }}>
                Gemini 2.0 Flash — AI Insights
              </p>
            </div>
            <p style={{
              fontSize:13, lineHeight:1.75, color:'rgba(255,255,255,.82)',
              fontStyle:'italic', borderLeft:'2px solid rgba(0,113,227,.45)',
              paddingLeft:14, marginLeft:2, marginBottom:18,
            }}>
              {selected.aiFeedback}
            </p>
          </div>
        ) : (
          <div style={{ ...bento(), border:'1px solid rgba(0,113,227,.06)', textAlign:'center' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.2)', letterSpacing:'.3px' }}>
              AI Insights not yet available for this candidate.
            </p>
          </div>
        )}

        <button onClick={closePassport} style={{
          width:'100%', padding:16, borderRadius:16,
          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
          color:'rgba(255,255,255,.7)', fontSize:14, fontWeight:600,
          cursor:'pointer', fontFamily:'Inter,sans-serif', letterSpacing:'.2px',
        }}>
          ← Leaderboard
        </button>
      </div>
    </div>
  );

  const avgScore    = candidates.length ? Math.round(candidates.reduce((s,c)=>s+c.globalScore,0)/candidates.length) : 0;
  const avgTech     = candidates.length ? Math.round(candidates.reduce((s,c)=>s+c.techScore,0)/candidates.length)   : 0;
  const cleanCount  = candidates.filter(c=>c.integrityStatus==='clean').length;
  const cleanPct    = candidates.length ? Math.round(cleanCount/candidates.length*100) : 0;
  const topChallenge = (() => {
    const freq = {};
    candidates.forEach(c=>{ freq[c.challengeTitle]=(freq[c.challengeTitle]||0)+1; });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
    return top ? top[0].split(' ').slice(0,2).join(' ') : '—';
  })();

  return (
    <div style={{
      height:'100%', background:'#1d1d1f', overflowY:'auto',
      overflowX:'hidden', WebkitOverflowScrolling:'touch',
      fontFamily:'Inter,sans-serif',
    }}>
      <div style={{
        position:'sticky', top:0, zIndex:10,
        padding:'44px 20px 16px',
        background:'linear-gradient(180deg,#1d1d1f 85%,transparent)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <p style={{ fontSize:9, color:'rgba(255,255,255,.3)', letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:4 }}>
              BioMatch — Recruiter View
            </p>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#f5f5f7', letterSpacing:'-.4px' }}>
              CEO Dashboard
            </h1>
          </div>
          <button onClick={onBack} style={{
            padding:'8px 14px', borderRadius:14,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)',
            color:'rgba(255,255,255,.6)', fontSize:12, fontWeight:600, cursor:'pointer',
          }}>Exit</button>
        </div>
      </div>

      <div style={{ padding:'0 16px 48px' }}>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          {[
            { label:'Candidatos',      value: candidates.length, unit:'',  color:'#f0f0f0' },
            { label:'Score Promedio',  value: avgScore,          unit:'',  color:'#0071e3' },
            { label:'Score Técnico',   value: avgTech,           unit:'',  color:'#60aaff' },
            { label:'Integridad OK',   value: cleanPct,          unit:'%', color:'#34d399' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{
              background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)',
              borderRadius:20, padding:'14px 14px',
            }}>
              <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:6 }}>{label}</p>
              <p style={{ fontSize:26, fontWeight:800, color, lineHeight:1, letterSpacing:'-0.5px' }}>
                {value}{unit}
              </p>
            </div>
          ))}
        </div>

        {candidates.length > 0 && (
          <div style={{
            background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)',
            borderRadius:20, padding:'16px 14px', marginBottom:10,
          }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:14 }}>
              Distribución de Scores Globales
            </p>
            <div style={{ height:120, position:'relative' }}>
              <canvas ref={chartRef}/>
            </div>
          </div>
        )}

        {candidates.length > 0 && (
          <div style={{
            background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)',
            borderRadius:20, padding:'14px 14px', marginBottom:10,
          }}>
            <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:12 }}>
              Integridad Biométrica
            </p>
            {[
              { key:'clean',          label:'Verificado',        color:'#34d399' },
              { key:'flagged',        label:'Advertencia / Revisión', color:'#fbbf24' },
            ].map(({ key, label, color }) => {
              const count = candidates.filter(c => (key==='clean' ? c.integrityStatus==='clean' : c.integrityStatus!=='clean')).length;
              const pct   = candidates.length ? Math.round(count/candidates.length*100) : 0;
              return (
                <div key={key} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                    <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{label}</p>
                    <p style={{ fontSize:12, fontWeight:700, color }}>{count} <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>({pct}%)</span></p>
                  </div>
                  <div style={{ height:3, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:3, background:color, width:`${pct}%`, transition:'width 1s ease' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'16px 0 8px' }}>
          <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:'0.8px', textTransform:'uppercase' }}>Leaderboard</p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>Identidades ocultas</p>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:12, overflowX:'auto', scrollbarWidth:'none' }}>
          {[['globalScore','Global'],['techScore','Técnico'],['commScore','Comun.']].map(([k,l]) => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              flexShrink:0, padding:'5px 14px', borderRadius:20, fontSize:11,
              fontWeight:600, cursor:'pointer', transition:'all 180ms ease',
              border:      sortKey===k ? '1px solid rgba(0,113,227,.4)' : '1px solid rgba(255,255,255,.08)',
              background:  sortKey===k ? 'rgba(0,113,227,.12)' : 'rgba(255,255,255,.03)',
              color:       sortKey===k ? '#60aaff' : '#86868b',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 52px 52px 52px auto', gap:12, padding:'0 16px 10px', alignItems:'center' }}>
          {['','Candidate','Global','Tech','Comm','Integrity'].map((h,i) => (
            <span key={h+i} style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.25)', letterSpacing:'1px', textTransform:'uppercase', textAlign: i>=2&&i<=4?'center':'left' }}>
              {h}
            </span>
          ))}
        </div>
        <div style={{ height:1, background:'rgba(255,255,255,.06)', marginBottom:8 }}/>

        {sorted.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 24px' }}>
            <p style={{ fontSize:36, marginBottom:12 }}>📭</p>
            <p style={{ fontSize:14, fontWeight:600, color:'#86868b' }}>No candidates yet</p>
            <p style={{ fontSize:12, color:'#4b5563', marginTop:6 }}>
              Data will appear here once candidates complete their One-Shot evaluation.
            </p>
          </div>
        )}

        {sorted.map((cand, idx) => (
          <button key={cand.anonId} onClick={() => openPassport(cand.anonId)} style={{
            width:'100%', display:'grid',
            gridTemplateColumns:'auto 1fr 52px 52px 52px auto',
            gap:12, padding:'12px 16px',
            background: passportId===cand.anonId ? 'rgba(0,113,227,.08)' : idx%2===0 ? 'rgba(255,255,255,.02)' : 'transparent',
            borderRadius:16,
            border: passportId===cand.anonId ? '1px solid rgba(0,113,227,.25)' : '1px solid rgba(255,255,255,.04)',
            cursor:'pointer', textAlign:'left',
            transition:'background 150ms ease, border-color 150ms ease',
            marginBottom:4, alignItems:'center',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,113,227,0.07)'; e.currentTarget.style.borderColor='rgba(0,113,227,0.2)'; }}
            onMouseLeave={e => {
              e.currentTarget.style.background = passportId===cand.anonId ? 'rgba(0,113,227,.08)' : idx%2===0 ? 'rgba(255,255,255,.02)' : 'transparent';
              e.currentTarget.style.borderColor = passportId===cand.anonId ? 'rgba(0,113,227,.25)' : 'rgba(255,255,255,.04)';
            }}
          >
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.2)', width:20, textAlign:'right' }}>{idx+1}</span>
            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
              <GridDotsAvatar/>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#f0f0f0', letterSpacing:'.2px' }}>{cand.anonId}</p>
                <p style={{ fontSize:11, color:'#86868b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:130 }}>
                  {cand.challengeTitle}
                </p>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'center' }}><MiniRing pct={cand.globalScore}/></div>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#0071e3' }}>{cand.techScore}</span>
            </div>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#60aaff' }}>{cand.commScore}</span>
            </div>
            <IntegrityBadge status={cand.integrityStatus}/>
          </button>
        ))}

        <div style={{ marginTop:24, padding:'16px 18px', borderRadius:18, background:'rgba(0,113,227,.05)', border:'1px solid rgba(0,113,227,.1)' }}>
          <p style={{ fontSize:11, color:'rgba(255,255,255,.35)', lineHeight:1.6, textAlign:'center' }}>
            Identities are revealed only upon opening the Talent Passport.<br/>
            Scores computed as <span style={{ color:'rgba(255,255,255,.5)', fontWeight:600 }}>60% Technical + 40% Communication</span>.<br/>
            Integrity status reflects FaceMesh 4 FPS biometric audit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScreenCEODashboard;

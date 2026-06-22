import React from 'react';
import DnaLogo from './shared/DnaLogo.jsx';
import { ZapIcon, BriefIcon } from './icons/Icons.jsx';

const ScreenLanding = ({ onSelectRole }) => {
  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      justifyContent:'center', padding:'0 32px', background:'#1d1d1f',
      position:'relative', overflow:'hidden',
    }}>
      <div className="midnight-bg"/>

      <div style={{ position:'relative', zIndex:10, textAlign:'center' }}>
        <div style={{ marginBottom:'40px', display:'flex', justifyContent:'center' }}>
          <DnaLogo />
        </div>

        <h1 style={{
          fontSize:'32px', fontWeight:800, color:'#f5f5f5',
          letterSpacing:'-1px', marginBottom:'12px', lineHeight:1.1,
        }}>BioMatch</h1>
        <p style={{
          fontSize:'14px', color:'rgba(255,255,255,.6)', fontWeight:500,
          letterSpacing:'.2px', textTransform:'uppercase', marginBottom:'48px',
        }}>The Standard of Scientific Trust</p>

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* CANDIDATE */}
          <button className="btn-teal" onClick={() => onSelectRole('candidate')}
            style={{ padding:'20px', borderRadius:'16px', border:'none',
              cursor:'pointer', display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ width:'40px', height:'40px', background:'rgba(255,255,255,0.1)',
              borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ZapIcon />
            </div>
            <div style={{ textAlign:'left' }}>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#fff', marginBottom:'2px' }}>I'm Talent</p>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)' }}>Prove your skills in One-Shot</p>
            </div>
          </button>

          {/* CEO */}
          <button className="btn-ghost" onClick={() => onSelectRole('ceo')}
            style={{ padding:'20px', borderRadius:'16px',
              cursor:'pointer', display:'flex', alignItems:'center', gap:'16px',
              border:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width:'40px', height:'40px', background:'rgba(0,113,227,0.08)',
              borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <BriefIcon />
            </div>
            <div style={{ textAlign:'left' }}>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#f0f0f0', marginBottom:'2px' }}>I'm a Startup / CEO</p>
              <p style={{ fontSize:'11px', color:'#6b7280' }}>Access verified scientific evidence</p>
            </div>
          </button>

        </div>
      </div>

      <p style={{
        position:'absolute', bottom:'40px', left:0, right:0,
        textAlign:'center', fontSize:'10px', color:'#4b5563', letterSpacing:'.2px',
      }}>SAN DIEGO · CDMX · LONDON</p>
    </div>
  );
};

export default ScreenLanding;

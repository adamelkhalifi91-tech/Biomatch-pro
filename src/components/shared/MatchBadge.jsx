import React from 'react';

const MatchBadge = ({ pct }) => {
  const col = "#0071e3";
  return (
    <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
      <div style={{width:28,height:28,borderRadius:"50%",background:`conic-gradient(${col} ${pct}%, rgba(255,255,255,.06) 0)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:"#1d1d1f",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:"8px",fontWeight:700,color:col,letterSpacing:"-0.3px"}}>{pct}</span>
        </div>
      </div>
      <span style={{fontSize:"11px",color:"#9CA3AF",fontWeight:500}}>match</span>
    </div>
  );
};

export default MatchBadge;

import React from 'react';

const ScoreRing = ({ pct, accent }) => {
  const r=50, circ=2*Math.PI*r;
  return (
    <svg width="116" height="116">
      <circle cx="58" cy="58" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5.5"/>
      <circle cx="58" cy="58" r={r} fill="none" stroke={accent} strokeWidth="5.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ-(pct/100)*circ} transform="rotate(-90 58 58)"
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1) .5s"}}/>
      <text x="58" y="52" textAnchor="middle" fill="#f5f5f7" fontSize="21" fontWeight="700" fontFamily="Inter,sans-serif">{pct}%</text>
      <text x="58" y="68" textAnchor="middle" fill="rgba(255,255,255,.45)" fontSize="10" fontFamily="Inter,sans-serif">match</text>
    </svg>
  );
};

export default ScoreRing;

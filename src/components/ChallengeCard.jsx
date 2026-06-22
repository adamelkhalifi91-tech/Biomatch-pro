import React from 'react';
import { BookmarkIcon, MapPinIcon, BriefIcon } from './icons/Icons.jsx';
import MatchBadge from './shared/MatchBadge.jsx';

const ChallengeCard = ({ data, animClass, onEnter, savedIds=[], onToggleSaved }) => {
  const saved = savedIds.includes(data.id);
  return (
    <div className={`challenge-card ${animClass}`} style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"28px",padding:"22px",display:"flex",flexDirection:"column",gap:"14px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:0}}>
          <div style={{width:42,height:42,borderRadius:"12px",background:data.logoColor+"22",border:`1px solid ${data.logoColor}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:"12px",fontWeight:700,color:data.accentColor,letterSpacing:".5px"}}>{data.logo}</span>
          </div>
          <div style={{minWidth:0}}>
            <p style={{fontSize:"13px",color:"#9CA3AF",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{data.company}</p>
            <h3 style={{fontSize:"16px",fontWeight:600,color:"#f0f0f0",lineHeight:1.3,marginTop:"2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{data.role}</h3>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"8px",flexShrink:0}}>
          <button onClick={()=>onToggleSaved?.(data.id)} style={{background:"none",border:"none",cursor:"pointer",color:saved?"#0071e3":"#4b5563",transition:"color 180ms ease",padding:"2px"}}>
            <BookmarkIcon active={saved} size={20}/>
          </button>
          <MatchBadge pct={data.match}/>
        </div>
      </div>

      <p style={{fontSize:"13px",color:"#6b7280",lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{data.desc}</p>

      <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:"4px",color:"#6b7280",fontSize:"12px"}}><MapPinIcon/>{data.location}</span>
        <span style={{display:"flex",alignItems:"center",gap:"4px",color:"#6b7280",fontSize:"12px"}}><BriefIcon/>{data.type}</span>
        <span style={{fontSize:"12px",color:"#9CA3AF",fontWeight:500,marginLeft:"auto"}}>{data.salary}</span>
      </div>

      <hr className="divider"/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",flex:1}}>
          {data.skills.map(sk=>(
            <span key={sk} className="skill-tag" style={{fontSize:"11px",fontWeight:600,color:"#0071e3",background:"rgba(0,113,227,0.10)",border:"1px solid rgba(0,113,227,0.20)",borderRadius:"6px",padding:"3px 8px",letterSpacing:".3px",transition:"background 200ms ease"}}>{sk}</span>
          ))}
        </div>
        <button className="btn-teal" onClick={()=>onEnter(data)} style={{flexShrink:0,padding:"9px 16px",borderRadius:"16px",fontSize:"13px",fontWeight:600,color:"#fff",border:"none",cursor:"pointer",letterSpacing:".1px",whiteSpace:"nowrap"}}>Enter Challenge →</button>
      </div>
    </div>
  );
};

export default ChallengeCard;

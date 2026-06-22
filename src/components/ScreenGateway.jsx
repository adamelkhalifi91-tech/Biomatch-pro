import React from 'react';
import ScoreRing from './shared/ScoreRing.jsx';
import { ArrowLeft, ClockIcon, ZapIcon, StarIcon, LockIcon } from './icons/Icons.jsx';

const ScreenGateway = ({ c, onBack, onStart }) => {
  const steps = [
    {num:"01",Icon:ClockIcon,badge:"60s · Preparation",title:"Read the Brief",desc:"A 60-second window to absorb the technical question. No scrolling back — read deliberately."},
    {num:"02",Icon:ZapIcon,badge:"120s · Response",title:"Show Your Expertise",desc:"120 seconds to deliver a structured technical answer. Concise and precise — exactly how real scientists communicate."},
    {num:"03",Icon:StarIcon,badge:"Instant",title:"Get Your Score",desc:"AI-assisted evaluation delivers your match score and written feedback in under 30 seconds after submission."},
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100%",background:"#1d1d1f"}}>
      <div style={{position:"sticky",top:0,zIndex:10,padding:"52px 20px 16px",background:"linear-gradient(180deg,#1d1d1f 90%,transparent)",display:"flex",alignItems:"center",gap:"10px"}}>
        <button onClick={onBack} className="btn-ghost" style={{display:"flex",alignItems:"center",gap:"6px",padding:"8px 14px",borderRadius:"10px",fontSize:"13px",fontWeight:500,color:"#9CA3AF",cursor:"pointer",border:"none"}}>
          <ArrowLeft/> BACK
        </button>
        <div style={{flex:1}}/>
        <span style={{fontSize:"10px",color:"#4b5563",fontWeight:600,letterSpacing:".2px",textTransform:"uppercase"}}>THE GATEWAY</span>
      </div>

      <div style={{padding:"4px 24px 0",textAlign:"center"}}>
        <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:"24px"}}>
          <ScoreRing pct={c.match} accent={c.accentColor}/>
          <div className="logo-pulse" style={{position:"absolute",right:"-12px",top:"-4px",width:52,height:52,borderRadius:"50%",background:c.logoColor+"28",border:`2px solid ${c.logoColor}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:"14px",fontWeight:800,color:c.accentColor,letterSpacing:".5px"}}>{c.logo}</span>
          </div>
        </div>
        <p style={{fontSize:"12px",color:"#9CA3AF",fontWeight:600,letterSpacing:".2px",textTransform:"uppercase",marginBottom:"6px"}}>{c.company}</p>
        <h2 style={{fontSize:"clamp(20px,5vw,24px)",fontWeight:700,color:"#f5f5f5",letterSpacing:"-0.5px",lineHeight:1.25,marginBottom:"12px"}}>{c.role}</h2>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",marginBottom:"24px"}}>
          {[c.type,c.location.split("·")[1]?.trim()||c.location,c.stage].map(tag=><span key={tag} className="gw-tag">{tag}</span>)}
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"22px",padding:"22px",marginBottom:"20px",textAlign:"left"}}>
          <p style={{fontSize:"14px",fontWeight:400,color:"#f0f0f0",lineHeight:1.75,fontStyle:"italic"}}>
            "We trust your expertise. At BioMatch, we don't believe in rehearsed scripts,{" "}
            <span style={{color:"#f5f5f7",fontWeight:700,fontStyle:"normal"}}>but in raw technical talent.</span>{" "}
            Take a breath. Trust your hands."
          </p>
          <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"12px"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:"#0071e3",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:"9px",fontWeight:700,color:"#fff"}}>AK</span>
            </div>
            <span style={{fontSize:"11px",color:"#6b7280"}}>Your profile — {c.match}% aligned with this role</span>
          </div>
        </div>
        <div style={{textAlign:"left",marginBottom:"20px"}}>
          <p style={{fontSize:"10px",color:"#4b5563",fontWeight:600,letterSpacing:".2px",textTransform:"uppercase",marginBottom:"8px"}}>Company Mission</p>
          <p style={{fontSize:"14px",color:"#9CA3AF",lineHeight:1.75}}>{c.mission}</p>
          <div style={{display:"flex",gap:"24px",marginTop:"14px"}}>
            {[{label:"Team",value:c.teamSize},{label:"Founded",value:c.founded},{label:"Stage",value:c.stage}].map(({label,value})=>(
              <div key={label}>
                <p style={{fontSize:"10px",color:"#4b5563",fontWeight:600,letterSpacing:".8px",textTransform:"uppercase"}}>{label}</p>
                <p style={{fontSize:"13px",color:"#e0e0e0",fontWeight:600,marginTop:"2px"}}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="divider" style={{margin:"0 24px"}}/>

      <div style={{padding:"22px 24px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"14px"}}>
          <div className="lock-dot" style={{width:6,height:6,borderRadius:"50%",background:"#0071e3"}}/>
          <p style={{fontSize:"10px",color:"#9CA3AF",fontWeight:600,letterSpacing:".2px"}}>60s / 60s Protocol</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"9px",marginBottom:"22px"}}>
          {steps.map((s,i)=>(
            <div key={s.num} className="step-card" style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:"22px",padding:"18px",display:"flex",alignItems:"flex-start",gap:"14px",animation:`fadeUp .38s ease ${.08+i*.1}s both`}}>
              <div style={{flexShrink:0,width:32,height:32,borderRadius:"9px",background:"rgba(0,113,227,0.08)",border:"1px solid rgba(0,113,227,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:"11px",fontWeight:700,color:"#f0f0f0"}}>{s.num}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"3px"}}>
                  <span style={{color:c.accentColor}}><s.Icon/></span>
                  <span style={{fontSize:"10px",fontWeight:700,color:"#9CA3AF",letterSpacing:".3px",textTransform:"uppercase"}}>{s.badge}</span>
                </div>
                <p style={{fontSize:"13px",fontWeight:600,color:"#e0e0e0",marginBottom:"3px"}}>{s.title}</p>
                <p style={{fontSize:"12px",color:"#6b7280",lineHeight:1.6}}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(25px)",WebkitBackdropFilter:"blur(25px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"24px",padding:"20px",marginBottom:"20px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",background:"linear-gradient(90deg,#0050b0,#0071e3)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <div style={{width:28,height:28,borderRadius:"8px",background:"rgba(0,113,227,0.1)",border:"1px solid rgba(180,60,0,.35)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{color:"#0071e3"}}><LockIcon/></span>
            </div>
            <div>
              <p style={{fontSize:"12px",fontWeight:700,color:"#e8e8e8",letterSpacing:".2px"}}>One-Shot · No Preview</p>
              <p style={{fontSize:"10px",color:"#9CA3AF",fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>Challenge Locked</p>
            </div>
          </div>
          <p style={{fontSize:"13px",color:"#9CA3AF",lineHeight:1.75,marginBottom:"12px"}}>
            The technical question is <span style={{color:"#f0f0f0",fontWeight:700}}>locked</span>. It will be revealed only when the <span style={{color:"#f0f0f0",fontWeight:600}}>60s preparation starts</span>.
          </p>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:"9px",padding:"10px 12px"}}>
            <p style={{fontSize:"11px",fontWeight:700,color:"#f0f0f0",marginBottom:"6px",letterSpacing:".3px"}}>{c.challengeTitle}</p>
            {[100,80,55].map((w,i)=><div key={i} style={{height:"8px",borderRadius:"4px",marginBottom:"5px",background:"rgba(255,255,255,.05)",width:`${w}%`,filter:"blur(2px)"}}/>)}
            <p style={{fontSize:"10px",color:"#4b5563",marginTop:"6px",fontWeight:500,display:"flex",alignItems:"center",gap:"5px"}}><span className="lock-dot">●</span> Full brief unlocks at challenge start — no retries allowed</p>
          </div>
        </div>

        <div style={{marginBottom:"24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
            <span style={{fontSize:"12px",color:"#9CA3AF",fontWeight:500}}>Profile alignment</span>
            <span style={{fontSize:"12px",color:"#f0f0f0",fontWeight:700}}>{c.match}%</span>
          </div>
          <div style={{background:"rgba(255,255,255,.06)",borderRadius:"99px",height:4,overflow:"hidden"}}>
            <div className="progress-fill" style={{height:"100%",borderRadius:"99px",background:"linear-gradient(90deg,#0050a0,#0071e3)","--tw":`${c.match}%`}}/>
          </div>
        </div>

        <button className="btn-teal" onClick={onStart} style={{width:"100%",padding:"17px",borderRadius:"16px",fontSize:"15px",fontWeight:700,color:"#fff",border:"none",cursor:"pointer",letterSpacing:".3px",marginBottom:"10px"}}>🧬 Start Challenge</button>
        <p style={{fontSize:"11px",color:"#4b5563",textAlign:"center",marginBottom:"10px",letterSpacing:".2px"}}>One attempt · Anonymous evaluation · Instant feedback</p>
        <button onClick={onBack} className="btn-ghost" style={{width:"100%",padding:"13px",borderRadius:"16px",fontSize:"13px",fontWeight:500,color:"#9CA3AF",cursor:"pointer",border:"none",letterSpacing:".2px",marginBottom:"36px"}}>← Back to Challenges</button>
      </div>
    </div>
  );
};

export default ScreenGateway;

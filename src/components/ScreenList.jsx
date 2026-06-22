import React, { useState, useEffect, useRef } from 'react';
import { CHALLENGES } from '../data/challenges.js';
import ChallengeCard from './ChallengeCard.jsx';
import DnaLogo from './shared/DnaLogo.jsx';
import { SearchIcon, BellIcon, BookmarkIcon, HomeIcon, SearchNavIcon, UserNavIcon } from './icons/Icons.jsx';

const ScreenList = ({ onEnter, activeTab, setActiveTab }) => {
  const [query,      setQuery]      = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [showBell,   setShowBell]   = useState(false);
  const [savedIds,   setSavedIds]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("bm_saved") || "[]"); } catch { return []; }
  });
  const searchRef = useRef(null);

  const toggleSaved = (id) => {
    setSavedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id];
      try { localStorage.setItem("bm_saved", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const FILTER_MAP = {
    "All": () => true,
    "Remote":    c => c.location.toLowerCase().includes("remote"),
    "Full-time": c => c.type === "Full-time",
    "Contract":  c => c.type === "Contract",
    "On-site":   c => c.location.toLowerCase().includes("on-site"),
  };

  const byFilter = CHALLENGES.filter(FILTER_MAP[activeFilter] || (()=>true));
  const filtered = byFilter.filter(c =>
    !query ||
    c.role.toLowerCase().includes(query.toLowerCase()) ||
    c.company.toLowerCase().includes(query.toLowerCase()) ||
    c.skills.some(s=>s.toLowerCase().includes(query.toLowerCase()))
  );
  const savedChallenges = CHALLENGES.filter(c => savedIds.includes(c.id));

  useEffect(() => {
    if (activeTab === "search") {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [activeTab]);

  const renderContent = () => {
    if (activeTab === "saved") return (
      <div style={{padding:"14px 20px 120px",display:"flex",flexDirection:"column",gap:"14px"}}>
        {savedChallenges.length === 0 ? (
          <div style={{textAlign:"center",padding:"60px 24px"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🔖</p>
            <p style={{fontSize:"15px",fontWeight:600,color:"#6b7280"}}>No saved challenges</p>
            <p style={{fontSize:"13px",color:"#4b5563",marginTop:"6px"}}>Tap the bookmark icon on any challenge to save it here.</p>
          </div>
        ) : savedChallenges.map((c,i) => (
          <ChallengeCard key={c.id} data={c} animClass={`card-anim-${Math.min(i+1,3)}`}
            onEnter={onEnter} savedIds={savedIds} onToggleSaved={toggleSaved}/>
        ))}
      </div>
    );

    if (activeTab === "profile") return (
      <div style={{padding:"24px 20px 120px"}}>
        <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:28,padding:24,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#0071e3",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:18,fontWeight:800,color:"#fff"}}>AK</span>
            </div>
            <div>
              <p style={{fontSize:17,fontWeight:700,color:"#f0f0f0"}}>Adam El Khalifi</p>
              <p style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>Biotechnology Candidate</p>
            </div>
          </div>
          {[
            ["Field",    "Biotechnology / Bioinfo"],
            ["Location", "Mexicali, MX"],
            ["Status",   "Active — seeking roles"],
            ["Passport", savedChallenges.length > 0 ? "Generated" : "Not yet generated"],
          ].map(([k,v]) => (
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid rgba(255,255,255,0.06)"}}>
              <span style={{fontSize:13,color:"#6b7280"}}>{k}</span>
              <span style={{fontSize:13,color:"#f0f0f0",fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(0,113,227,0.06)",border:"1px solid rgba(0,113,227,0.15)",borderRadius:22,padding:"14px 18px",textAlign:"center"}}>
          <p style={{fontSize:12,color:"rgba(0,113,227,0.8)",lineHeight:1.6}}>
            Complete a One-Shot challenge to generate your official Talent Passport.
          </p>
        </div>
      </div>
    );

    return (
      <>
        <div style={{padding:"14px 20px 120px",display:"flex",flexDirection:"column",gap:"14px"}}>
          {filtered.length>0 ? filtered.map((c,i)=>(
            <ChallengeCard key={c.id} data={c} animClass={`card-anim-${Math.min(i+1,3)}`}
              onEnter={onEnter} savedIds={savedIds} onToggleSaved={toggleSaved}/>
          )) : (
            <div style={{textAlign:"center",padding:"60px 24px",color:"#4b5563"}}>
              <p style={{fontSize:"40px",marginBottom:"12px"}}>🔬</p>
              <p style={{fontSize:"15px",fontWeight:600,color:"#6b7280"}}>No results found</p>
              <p style={{fontSize:"13px",marginTop:"6px"}}>Try a different keyword or filter</p>
            </div>
          )}
        </div>
      </>
    );
  };

  const pageTitle = activeTab==="saved" ? "Saved Challenges"
    : activeTab==="profile" ? "My Profile"
    : "Available Challenges";
  const pageCount = activeTab==="saved"
    ? `${savedChallenges.length} saved`
    : activeTab==="profile" ? null
    : `${filtered.length} positions · Updated today`;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>

        <div style={{padding:"52px 24px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <DnaLogo/>
              <div>
                <p style={{fontSize:"16px",fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.3px"}}>BioMatch</p>
                <p style={{fontSize:"11px",color:"#9CA3AF",fontWeight:500,letterSpacing:".6px",marginTop:"-1px"}}>SCIENCE · CAREERS</p>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
              <div style={{position:"relative"}}>
                <button aria-label="Notifications" onClick={()=>setShowBell(v=>!v)}
                  style={{background:"none",border:"none",cursor:"pointer",color:showBell?"#0071e3":"#6b7280",padding:"4px",position:"relative",transition:"color 180ms ease"}}>
                  <BellIcon/>
                  <span style={{position:"absolute",top:"3px",right:"3px",width:"7px",height:"7px",borderRadius:"50%",background:"#0071e3",border:"2px solid #1d1d1f"}}/>
                </button>
                {showBell && (
                  <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:240,background:"rgba(29,29,31,0.98)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:18,padding:"14px 16px",zIndex:50,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)"}}>
                    <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:10}}>Notifications</p>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#0071e3",flexShrink:0}}/>
                      <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>New challenge added: <strong style={{color:"#f0f0f0"}}>Bioinformatics Engineer</strong> at Helix Bio</p>
                    </div>
                    <div style={{borderTop:"0.5px solid rgba(255,255,255,0.06)",marginTop:8,paddingTop:10}}>
                      <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>No more notifications</p>
                    </div>
                  </div>
                )}
              </div>
              <button aria-label="User profile" onClick={()=>setActiveTab("profile")}
                className="avatar-ring" style={{width:38,height:38,borderRadius:"50%",background:"#0071e3",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:"13px",fontWeight:700,color:"#fff",letterSpacing:"-0.3px"}}>AK</span>
              </button>
            </div>
          </div>

          <div style={{marginBottom:"20px"}}>
            <p style={{fontSize:"13px",color:"#9CA3AF"}}>
              {activeTab==="profile" ? "Your BioMatch account" : "Good morning, Adam 👋"}
            </p>
            <h1 style={{fontSize:"clamp(22px,5vw,26px)",fontWeight:700,color:"#f5f5f5",letterSpacing:"-0.6px",lineHeight:1.25,marginTop:"4px"}}>{pageTitle}</h1>
            {pageCount && <p style={{fontSize:"13px",color:"#4b5563",marginTop:"4px"}}>{pageCount}</p>}
          </div>
        </div>

        {(activeTab==="home"||activeTab==="search") && (
          <div style={{position:"sticky",top:0,zIndex:20,padding:"10px 20px",background:"transparent",pointerEvents:"none"}}>
            <div style={{position:"relative",pointerEvents:"auto"}}>
              <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"#4b5563",pointerEvents:"none",display:"flex",alignItems:"center"}}>
                <SearchIcon/>
              </span>
              <input ref={searchRef} type="text" className="search-input"
                placeholder="Search role, company or skill…"
                value={query} onChange={e=>setQuery(e.target.value)}
                style={{width:"100%",background:"rgba(14,14,14,0.72)",border:"1px solid rgba(255,255,255,.10)",borderRadius:"14px",padding:"9px 14px 9px 36px",fontSize:"13px",color:"#f0f0f0",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",boxShadow:"0 4px 24px rgba(0,0,0,.45)",transition:"border-color 180ms ease, box-shadow 180ms ease"}}/>
              {query && (
                <button onClick={()=>setQuery("")} aria-label="Clear"
                  style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4b5563",fontSize:"18px"}}>×</button>
              )}
            </div>
          </div>
        )}

        {(activeTab==="home"||activeTab==="search") && (
          <div style={{padding:"12px 24px 0",display:"flex",gap:"8px",overflowX:"auto",scrollbarWidth:"none"}}>
            {["All","Remote","Full-time","Contract","On-site"].map(f => {
              const isActive = activeFilter === f;
              return (
                <button key={f} onClick={()=>setActiveFilter(f)}
                  style={{flexShrink:0,padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:500,cursor:"pointer",transition:"all 180ms ease",
                    border:   isActive?"1px solid rgba(0,113,227,.4)":"1px solid rgba(255,255,255,.07)",
                    background:isActive?"rgba(0,113,227,0.10)":"rgba(255,255,255,.03)",
                    color:    isActive?"#60aaff":"#6b7280"}}>{f}</button>
              );
            })}
          </div>
        )}

        {renderContent()}

      </div>

      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"420px",background:"rgba(29,29,31,0.88)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"12px 8px 28px",zIndex:20}}>
        {[
          {id:"home",   label:"Home",    Icon:HomeIcon},
          {id:"search", label:"Explore", Icon:SearchNavIcon},
          {id:"saved",  label:"Saved",   Icon:BookmarkIcon},
          {id:"profile",label:"Profile", Icon:UserNavIcon},
        ].map(({id,label,Icon})=>{
          const isActive=activeTab===id;
          const badge = id==="saved" && savedChallenges.length > 0;
          return (
            <button key={id} onClick={()=>setActiveTab(id)} aria-label={label}
              style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",padding:"4px 12px",minWidth:"44px",minHeight:"44px",justifyContent:"center",color:isActive?"#0071e3":"#4b5563",transition:"color 180ms ease",position:"relative"}}>
              <Icon active={isActive}/>
              {badge && <span style={{position:"absolute",top:2,right:6,width:7,height:7,borderRadius:"50%",background:"#0071e3",border:"2px solid rgba(29,29,31,0.88)"}}/>}
              <span style={{fontSize:"10px",fontWeight:isActive?600:400,letterSpacing:".3px"}}>{label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
};

export default ScreenList;

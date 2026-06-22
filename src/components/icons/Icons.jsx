import React from 'react';

export const Ico = ({ d, size=16, sw=1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

export const SearchIcon    = () => <Ico d={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>}/>;
export const MapPinIcon    = () => <Ico d={<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>} size={12} sw={2}/>;
export const BriefIcon     = () => <Ico d={<><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>} size={12} sw={2}/>;
export const BellIcon      = () => <Ico d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>} size={20} sw={1.7}/>;
export const ArrowLeft     = () => <Ico d={<path d="m15 18-6-6 6-6"/>} size={20}/>;
export const LockIcon      = () => <Ico d={<><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>} size={16} sw={2}/>;
export const ClockIcon     = () => <Ico d={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>} size={14} sw={2}/>;
export const ZapIcon       = () => <Ico d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>} size={14} sw={2}/>;
export const StarIcon      = () => <Ico d={<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>} size={14} sw={2}/>;
export const CameraIcon    = () => <Ico d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>} size={14} sw={2}/>;
export const HomeIcon      = ({ active }) => <Ico d={<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>} size={22} sw={active?"2":"1.7"}/>;
export const SearchNavIcon = ({ active }) => <Ico d={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>} size={22} sw={active?"2":"1.7"}/>;
export const BookmarkIcon  = ({ active, size=22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={active?"currentColor":"none"}
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
);
export const UserNavIcon   = ({ active }) => <Ico d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} size={22} sw={active?"2":"1.7"}/>;

export const IcoSvg = ({ d, size = 16, sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const ChevronLeft  = () => <IcoSvg d="m15 18-6-6 6-6" size={18} />;

export const ShieldCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

export const ShieldAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

export const BrainIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="#0071e3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2a2.5 2.5 0 0 1 5 0c1.5.3 2.7 1.4 3 2.9A3 3 0 0 1 21 8c0 1-.4 2-1 2.7V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.3A3 3 0 0 1 3 8a3 3 0 0 1 3.5-2.9c.3-1.5 1.5-2.6 3-2.9z"/>
  </svg>
);

export const GridDotsAvatar = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="10" fill="rgba(255,255,255,0.06)"/>
    {[8,14,20].map(y => [8,14,20].map(x => (
      <circle key={`${x}-${y}`} cx={x+2} cy={y+2} r="1.8" fill="rgba(255,255,255,0.25)"/>
    )))}
  </svg>
);

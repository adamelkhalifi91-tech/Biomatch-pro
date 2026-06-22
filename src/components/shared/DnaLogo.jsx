import React from 'react';

const DnaLogo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="8" fill="#0071e3" fillOpacity=".12"/>
    <path d="M10 7c0 0 2 3 4 3s4-3 4-3" stroke="#0071e3" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M10 21c0 0 2-3 4-3s4 3 4 3" stroke="#0071e3" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="14" y1="7" x2="14" y2="21" stroke="#0071e3" strokeWidth="1.4" strokeDasharray="2 2"/>
    <circle cx="10" cy="12" r="1.5" fill="#0071e3"/>
    <circle cx="18" cy="12" r="1.5" fill="#0071e3"/>
    <circle cx="10" cy="16" r="1.5" fill="#004eb3" fillOpacity=".65"/>
    <circle cx="18" cy="16" r="1.5" fill="#004eb3" fillOpacity=".65"/>
  </svg>
);

export default DnaLogo;

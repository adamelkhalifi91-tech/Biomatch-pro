/**
 * QualityBadge — discreet signal-quality indicator for the proctoring UX.
 *
 * Surfaces the `SignalQuality` from the quality gate so the candidate gets
 * gentle, actionable feedback ("Acércate a la cámara") instead of silent
 * degradation. Intentionally low-key: a small dot + label, not an alarm.
 */

import type { SignalQuality } from '../../lib/gaze/types';

export interface QualityBadgeProps {
  quality: SignalQuality;
  /** Optional override message (e.g. a specific hint from the gate reasons). */
  message?: string;
  zIndex?: number;
}

const STYLES: Record<SignalQuality, { color: string; label: string; hint: string }> = {
  good: { color: '#00e08a', label: 'Señal óptima', hint: '' },
  fair: { color: '#7bc8ff', label: 'Señal aceptable', hint: '' },
  poor: { color: '#ffaa40', label: 'Señal débil', hint: 'Mejora la luz o céntrate en la cámara' },
  lost: { color: '#ff5a5a', label: 'Sin señal', hint: 'Acércate y mira a la cámara' },
};

export default function QualityBadge({ quality, message, zIndex = 20 }: QualityBadgeProps) {
  const s = STYLES[quality];
  const hint = message ?? s.hint;
  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.45)',
        border: `0.5px solid ${s.color}55`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'none',
        fontFamily: "'Inter',sans-serif",
        maxWidth: 220,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: s.color,
          boxShadow: `0 0 8px ${s.color}aa`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.3px', color: s.color }}>
        {s.label}
        {hint ? <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}> · {hint}</span> : null}
      </span>
    </div>
  );
}

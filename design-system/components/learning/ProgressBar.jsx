import React from 'react';

/** Linear progress bar. tone: primary | success | gold */
export function ProgressBar({ value = 0, max = 100, tone = 'primary', height = 8, label, style = {} }) {
  const tones = { primary: 'var(--primary)', success: 'var(--success)', gold: 'var(--gold)' };
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-ui)', ...style }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--type-small-size)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          <span style={{ color: 'var(--text-faint)' }}>{value}/{max}</span>
        </div>
      )}
      <div style={{ height, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{
          width: pct + '%', height: '100%', borderRadius: 'var(--radius-pill)',
          background: tones[tone], transition: 'width var(--dur-med) var(--ease-out)',
        }}></div>
      </div>
    </div>
  );
}

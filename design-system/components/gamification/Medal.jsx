import React from 'react';
import { StarGlyph } from './StarsPill.jsx';
import { FlameGlyph } from './StreakPill.jsx';

/** Achievement medal. kind: star | flame | check. earned=false renders greyed placeholder. */
export function Medal({ kind = 'star', label, earned = true, size = 64, style = {} }) {
  const glyphs = {
    star: <StarGlyph size={size * 0.42} />,
    flame: <FlameGlyph size={size * 0.42} />,
    check: <span style={{ fontSize: size * 0.4, fontWeight: 800, lineHeight: 1 }}>✓</span>,
  };
  const ring = earned ? 'var(--gold)' : 'var(--surface-3)';
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', width: size + 24, ...style }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: earned ? 'var(--gold-soft)' : 'var(--surface-2)',
        color: earned ? 'var(--gold-text)' : 'var(--text-faint)',
        border: '3px solid ' + ring,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: earned ? 'var(--shadow-card)' : 'none',
      }}>
        {glyphs[kind]}
      </div>
      {label && <span style={{
        fontSize: 'var(--type-caption-size)', fontWeight: 600, textAlign: 'center',
        color: earned ? 'var(--text)' : 'var(--text-faint)', lineHeight: 1.35,
      }}>{label}</span>}
    </div>
  );
}

import React from 'react';

/** 5-point star glyph (SVG), inherits currentColor. */
export function StarGlyph({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z" />
    </svg>
  );
}

/** Star-points pill (gold). delta mode renders "+40" reward chip style. */
export function StarsPill({ stars = 0, delta = false, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--gold-soft)', color: 'var(--gold-text)',
      borderRadius: delta ? 'var(--radius-sm)' : 'var(--radius-pill)',
      padding: delta ? '3px 9px' : '6px 14px',
      fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: delta ? 12.5 : 14, ...style,
    }}>
      <StarGlyph size={delta ? 12 : 15} />
      {delta ? '+' + stars : stars}
    </span>
  );
}

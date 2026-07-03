import React from 'react';

/** Small flame glyph (SVG), inherits currentColor. */
export function FlameGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z" />
      <circle cx="8" cy="10.6" r="2.1" fill="var(--surface, #fff)" opacity="0.85" />
    </svg>
  );
}

/** Streak counter pill: flame + consecutive days. */
export function StreakPill({ days = 0, active = true, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--primary-soft)', color: active ? 'var(--primary-soft-text)' : 'var(--text-faint)',
      borderRadius: 'var(--radius-pill)', padding: '6px 14px',
      fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14, ...style,
    }}>
      <FlameGlyph size={15} />
      {days}
      <span style={{ fontWeight: 400, fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)' }}>ימים ברצף</span>
    </span>
  );
}

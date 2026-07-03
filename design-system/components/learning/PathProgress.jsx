import React from 'react';

/** Step path (gamified progress). steps: total count; current: 1-based active step.
    Steps below current render as done (✓), current is enlarged, rest are upcoming. */
export function PathProgress({ steps = 5, current = 1, finishIcon = '🏁', style = {} }) {
  const items = [];
  for (let i = 1; i <= steps; i++) {
    const done = i < current;
    const active = i === current;
    items.push(
      <span key={'s' + i} style={{
        width: active ? 44 : 34, height: active ? 44 : 34, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: active ? 15 : 14,
        background: done ? 'var(--primary)' : active ? 'var(--surface)' : 'var(--surface-2)',
        color: done ? '#fff' : active ? 'var(--primary-soft-text)' : 'var(--text-faint)',
        border: active ? '3px solid var(--primary)' : '3px solid transparent',
        boxShadow: active ? 'var(--shadow-card)' : 'none',
        boxSizing: 'border-box',
        transition: 'all var(--dur-med) var(--ease-spring)',
      }}>{done ? '✓' : i === steps ? finishIcon : i}</span>
    );
    if (i < steps) {
      const filled = i < current;
      const half = i === current - 0; // connector after current is empty
      items.push(
        <span key={'c' + i} style={{
          flex: 1, height: 4, minWidth: 12,
          background: filled ? 'var(--primary)' : 'var(--surface-3)',
        }}></span>
      );
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', ...style }}>
      {items}
    </div>
  );
}

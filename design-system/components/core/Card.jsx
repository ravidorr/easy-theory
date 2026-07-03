import React from 'react';

/** Surface card. level: main (radius 20) | nested (radius 16). pad: px number. */
export function Card({ level = 'main', pad = 20, children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: level === 'main' ? 'var(--radius-xl)' : 'var(--radius-lg)',
        boxShadow: level === 'main' ? 'var(--shadow-card)' : 'none',
        padding: pad,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

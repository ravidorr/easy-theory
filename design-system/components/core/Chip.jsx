import React from 'react';

/** Small rounded label. tone: neutral | primary | gold | success | danger */
export function Chip({ tone = 'neutral', icon = null, children, style = {} }) {
  const tones = {
    neutral: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
    primary: { background: 'var(--primary-soft)', color: 'var(--primary-soft-text)' },
    gold: { background: 'var(--gold-soft)', color: 'var(--gold-text)' },
    success: { background: 'var(--success-soft)', color: 'var(--success-text)' },
    danger: { background: 'var(--danger-soft)', color: 'var(--danger-text)' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 'var(--radius-pill)', padding: '4px 12px',
      fontFamily: 'var(--font-ui)', fontSize: 'var(--type-caption-size)', fontWeight: 600,
      lineHeight: 1.6, whiteSpace: 'nowrap',
      ...tones[tone], ...style,
    }}>
      {icon}
      {children}
    </span>
  );
}

import React from 'react';

/** Square icon-only button, 44px hit target. */
export function IconButton({ icon, label, variant = 'secondary', onClick, style = {} }) {
  const variants = {
    secondary: { background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' },
    ghost: { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)' },
    soft: { background: 'var(--primary-soft)', border: '1px solid transparent', color: 'var(--primary-soft-text)' },
  };
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 'var(--hit-min)', height: 'var(--hit-min)',
        borderRadius: 'var(--radius-md)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'background var(--dur-fast)',
        ...variants[variant], ...style,
      }}
    >
      {icon}
    </button>
  );
}

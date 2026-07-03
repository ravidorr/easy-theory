import React from 'react';

/** Primary "pressable" button. variant: primary | secondary | ghost | danger; size: md | lg */
export function Button({ variant = 'primary', size = 'md', fullWidth = false, disabled = false, icon = null, children, onClick, style = {} }) {
  const [down, setDown] = React.useState(false);
  const base = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: size === 'lg' ? 17 : 15.5,
    minHeight: size === 'lg' ? 52 : 'var(--hit-min)',
    padding: size === 'lg' ? '14px 28px' : '10px 22px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : undefined,
    transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast)',
    opacity: disabled ? 0.5 : 1,
    userSelect: 'none',
  };
  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--text-on-primary)',
      boxShadow: down ? 'var(--shadow-press-down)' : 'var(--shadow-press)',
      transform: down ? 'translateY(2px)' : 'none',
    },
    secondary: {
      background: 'var(--surface)',
      color: 'var(--text)',
      border: '1px solid var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--primary-soft-text)',
    },
    danger: {
      background: 'var(--danger)',
      color: '#fff',
    },
  };
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
    >
      {icon}
      {children}
    </button>
  );
}

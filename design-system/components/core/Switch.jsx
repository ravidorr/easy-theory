import React from 'react';

/** Toggle switch; RTL-aware (knob travels left when on). */
export function Switch({ checked = false, onChange, label, style = {} }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'var(--font-ui)', minHeight: 'var(--hit-min)', ...style }}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 46, height: 28, borderRadius: 'var(--radius-pill)', position: 'relative',
          background: checked ? 'var(--primary)' : 'var(--surface-3)',
          transition: 'background var(--dur-med) var(--ease-out)', flexShrink: 0, display: 'inline-block',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, insetInlineStart: checked ? 21 : 3,
          width: 22, height: 22, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(24,32,60,0.25)',
          transition: 'inset-inline-start var(--dur-med) var(--ease-spring)',
        }}></span>
      </span>
      {label && <span style={{ fontSize: 'var(--type-body-size)', color: 'var(--text)' }}>{label}</span>}
    </label>
  );
}

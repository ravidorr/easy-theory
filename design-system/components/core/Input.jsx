import React from 'react';

/** Text input with optional label; RTL by default. */
export function Input({ label, value, onChange, placeholder, type = 'text', style = {} }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-ui)', ...style }}>
      {label && <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          fontFamily: 'var(--font-ui)', fontSize: 'var(--type-body-size)', color: 'var(--text)',
          background: 'var(--surface)',
          border: focus ? '1.5px solid var(--primary)' : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          padding: '11px 14px', minHeight: 'var(--hit-min)', boxSizing: 'border-box',
          outline: 'none', transition: 'border-color var(--dur-fast)',
        }}
      />
    </label>
  );
}

import React from 'react';

/** Multiple-choice answer row. state: idle | selected | correct | wrong */
export function QuizOption({ state = 'idle', letter, children, explanation, onClick, style = {} }) {
  const states = {
    idle: { border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' },
    selected: { border: '1.5px solid var(--primary)', background: 'var(--primary-soft)', color: 'var(--text)' },
    correct: { border: '1.5px solid var(--success)', background: 'var(--success-soft)', color: 'var(--text)' },
    wrong: { border: '1.5px solid var(--danger)', background: 'var(--danger-soft)', color: 'var(--text)' },
  };
  const badge = {
    idle: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
    selected: { background: 'var(--primary)', color: '#fff' },
    correct: { background: 'var(--success)', color: '#fff' },
    wrong: { background: 'var(--danger)', color: '#fff' },
  };
  const mark = state === 'correct' ? '✓' : state === 'wrong' ? '✕' : letter;
  return (
    <div onClick={onClick} style={{
      borderRadius: 'var(--radius-lg)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'var(--font-ui)',
      transition: 'background var(--dur-fast), border-color var(--dur-fast)',
      minHeight: 'var(--hit-min)', boxSizing: 'border-box', justifyContent: 'center',
      ...states[state], ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, ...badge[state],
        }}>{mark}</span>
        <span style={{ fontSize: 'var(--type-body-size)', lineHeight: 'var(--line-body)' }}>{children}</span>
      </div>
      {explanation && (state === 'correct' || state === 'wrong') && (
        <div style={{
          fontSize: 'var(--type-small-size)', color: 'var(--text-muted)',
          lineHeight: 'var(--line-body)', paddingInlineStart: 40,
        }}>{explanation}</div>
      )}
    </div>
  );
}

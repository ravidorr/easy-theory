import React from 'react';

const ICONS = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  topics: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /></svg>,
  cards: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  more: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
};

const TABS = [
  { key: 'home', label: 'הבית' },
  { key: 'topics', label: 'נושאים' },
  { key: 'cards', label: 'כרטיסיות' },
  { key: 'more', label: 'עוד' },
];

/** Bottom tab bar (4 quiet tabs). Screens using it need padding-bottom ~88px.
    Shown on top-level screens only; focused flows (quiz, flashcard session, login, setup) hide it. */
export function TabBar({ active = 'home', onNavigate, style = {} }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, insetInlineStart: 0,
      width: '100%', maxWidth: 420, boxSizing: 'border-box',
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      display: 'flex', padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
      fontFamily: 'var(--font-ui)', ...style,
    }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <a
            key={t.key}
            onClick={() => onNavigate && onNavigate(t.key)}
            style={{
              flex: 1, minHeight: 'var(--hit-min)', cursor: 'pointer', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: isActive ? 'var(--primary-soft-text)' : 'var(--text-faint)',
              transition: 'color var(--dur-fast)',
            }}
          >
            {ICONS[t.key]}
            <span style={{ fontSize: 'var(--type-caption-size)', fontWeight: isActive ? 700 : 600 }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

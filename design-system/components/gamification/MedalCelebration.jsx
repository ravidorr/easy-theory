import React from 'react';
import { Medal } from './Medal.jsx';

/** Celebration modal shown once when POST /api/quiz returns medals_earned.
    Calm celebration: scrim + card pop, no confetti, no ambient animation.
    Dismiss via button or scrim tap; never auto-dismiss mid-read. */
export function MedalCelebration({ medal, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(24, 32, 60, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="מדליה חדשה"
        style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-pop)', padding: '32px 28px 24px',
          width: '100%', maxWidth: 320, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          textAlign: 'center', fontFamily: 'var(--font-ui)',
          animation: 'medal-pop var(--dur-med) var(--ease-spring)',
        }}
      >
        <Medal icon={medal.icon} label={medal.label} earned />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--type-h2-size)', fontWeight: 'var(--type-h2-weight)', color: 'var(--text)' }}>
            מדליה חדשה! 🎉
          </h2>
          <span style={{ fontSize: 'var(--type-small-size)', color: 'var(--text-muted)', lineHeight: 'var(--line-body)' }}>
            {medal.description}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 15.5,
            minHeight: 'var(--hit-min)', padding: '10px 22px', width: '100%',
            borderRadius: 'var(--radius-lg)', border: '1px solid transparent', cursor: 'pointer',
            background: 'var(--primary)', color: 'var(--text-on-primary)', boxShadow: 'var(--shadow-press)',
          }}
        >
          מעולה, ממשיכות!
        </button>
      </div>
    </div>
  );
}

/* @keyframes medal-pop (add once, e.g. in a global stylesheet):
   from { transform: scale(0.85); opacity: 0; }
   to   { transform: scale(1);    opacity: 1; } */

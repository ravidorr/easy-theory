import React from 'react';

/** Topic list row: name, mastery %, progress bar, optional sign thumbnail. */
export function TopicCard({ title, subtitle, value = 0, max = 100, image, done = false, onClick, style = {} }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 16,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'var(--font-ui)',
      boxShadow: 'var(--shadow-card)', transition: 'transform var(--dur-fast) var(--ease-out)',
      ...style,
    }}>
      {image && (
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <img src={image} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--type-body-size)', color: 'var(--text)' }}>{title}</span>
          <span style={{ fontSize: 'var(--type-caption-size)', fontWeight: 600, color: done ? 'var(--success-text)' : 'var(--text-faint)' }}>
            {done ? '✓ הושלם' : Math.round((value / max) * 100) + '%'}
          </span>
        </div>
        {subtitle && <span style={{ fontSize: 'var(--type-small-size)', color: 'var(--text-muted)' }}>{subtitle}</span>}
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{
            width: Math.min(100, (value / max) * 100) + '%', height: '100%',
            borderRadius: 'var(--radius-pill)',
            background: done ? 'var(--success)' : 'var(--primary)',
          }}></div>
        </div>
      </div>
    </div>
  );
}

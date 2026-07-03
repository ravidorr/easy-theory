import React from 'react';

/** Flip card for traffic-sign memorization. Front: sign image; back: meaning. */
export function Flashcard({ image, alt, title, meaning, flipped, onFlip, width = 240, height = 300, style = {} }) {
  const [internal, setInternal] = React.useState(false);
  const isFlipped = flipped !== undefined ? flipped : internal;
  const flip = () => (onFlip ? onFlip(!isFlipped) : setInternal(!isFlipped));
  const face = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
    borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: 20, boxSizing: 'border-box', boxShadow: 'var(--shadow-card)',
  };
  return (
    <div onClick={flip} style={{ width, height, perspective: 900, cursor: 'pointer', fontFamily: 'var(--font-ui)', ...style }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform var(--dur-flip) var(--ease-spring)',
        transform: isFlipped ? 'rotateY(180deg)' : 'none',
      }}>
        <div style={{ ...face, background: 'var(--surface)' }}>
          <img src={image} alt={alt || title} style={{ width: '65%', maxHeight: '60%', objectFit: 'contain' }} />
          <span style={{ fontSize: 'var(--type-caption-size)', fontWeight: 600, color: 'var(--text-faint)' }}>הקליקי להיפוך</span>
        </div>
        <div style={{ ...face, background: 'var(--primary-soft)', transform: 'rotateY(180deg)' }}>
          <span style={{ fontSize: 'var(--type-h2-size)', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{title}</span>
          <span style={{ fontSize: 'var(--type-small-size)', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 'var(--line-body)' }}>{meaning}</span>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export interface MedalProps {
  /** Glyph inside the medal */
  kind?: 'star' | 'flame' | 'check';
  /** Short achievement name, e.g. "3 ימים ברצף" */
  label?: string;
  /** false = locked/grey placeholder */
  earned?: boolean;
  /** Circle diameter px */
  size?: number;
  style?: React.CSSProperties;
}

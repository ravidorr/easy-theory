import React from 'react';

export interface CardProps {
  /** main = top-level card (radius 20 + shadow); nested = inner card (radius 16, no shadow) */
  level?: 'main' | 'nested';
  /** padding in px, default 20 */
  pad?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

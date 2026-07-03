import React from 'react';

export interface ProgressBarProps {
  value?: number;
  max?: number;
  tone?: 'primary' | 'success' | 'gold';
  /** Track height px, default 8 */
  height?: number;
  /** Optional label row with value/max counter */
  label?: string;
  style?: React.CSSProperties;
}

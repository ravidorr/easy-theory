import React from 'react';

export interface PathProgressProps {
  /** Total steps including the finish step */
  steps?: number;
  /** 1-based current step; earlier steps show ✓ */
  current?: number;
  /** Glyph in the last circle, default 🏁 */
  finishIcon?: string;
  style?: React.CSSProperties;
}

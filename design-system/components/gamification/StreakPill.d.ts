import React from 'react';

export interface StreakPillProps {
  /** Consecutive learning days */
  days?: number;
  /** Dim the pill when the streak is broken */
  active?: boolean;
  style?: React.CSSProperties;
}

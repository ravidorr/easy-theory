import React from 'react';

export interface StarsPillProps {
  /** Total stars, or reward amount when delta=true */
  stars?: number;
  /** Render as a small "+N" reward chip */
  delta?: boolean;
  style?: React.CSSProperties;
}

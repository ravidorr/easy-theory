import React from 'react';

export interface TopicCardProps {
  /** Topic name, e.g. "תמרורים" */
  title: string;
  /** e.g. "12 מתוך 21 כרטיסיות" */
  subtitle?: string;
  value?: number;
  max?: number;
  /** Optional thumbnail (sign PNG) */
  image?: string;
  /** Completed state: green bar + ✓ הושלם */
  done?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

import React from 'react';

export interface IconButtonProps {
  /** Icon node (Lucide SVG ~20px) */
  icon: React.ReactNode;
  /** Accessible label (Hebrew) */
  label: string;
  variant?: 'secondary' | 'ghost' | 'soft';
  onClick?: () => void;
  style?: React.CSSProperties;
}

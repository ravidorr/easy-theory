import React from 'react';

/** Utility interface documentation lives in Button.d.ts */
export interface ButtonProps {
  /** primary = pressable lilac CTA; secondary = surface+border; ghost = text only; danger = red */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  /** Optional leading icon node (Lucide SVG, 18px) */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

import React from 'react';

export interface ChipProps {
  tone?: 'neutral' | 'primary' | 'gold' | 'success' | 'danger';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

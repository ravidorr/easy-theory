import React from 'react';

export interface InputProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  style?: React.CSSProperties;
}

import React from 'react';

export interface FlashcardProps {
  /** Path to sign PNG from assets/signs/ */
  image: string;
  alt?: string;
  /** Sign name, e.g. "תן זכות קדימה" */
  title: string;
  /** Meaning / rule text shown on the back */
  meaning?: string;
  /** Controlled flip state (uncontrolled if omitted) */
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

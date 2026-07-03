import React from 'react';

export interface QuizOptionProps {
  /** idle | selected | correct | wrong. correct/wrong reveal the explanation. */
  state?: 'idle' | 'selected' | 'correct' | 'wrong';
  /** Answer letter shown in the circle while idle/selected, e.g. "א" */
  letter?: string;
  children?: React.ReactNode;
  /** Short reason shown after answering (PRD: every answer has an explanation) */
  explanation?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

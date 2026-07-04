import * as React from 'react';

export interface EarnedMedal {
  /** Glyph key passed through to Medal: 'star' | 'flame' | 'check'. */
  icon: 'star' | 'flame' | 'check';
  /** Short medal name, e.g. "5 ימים ברצף". */
  label: string;
  /** One warm sentence shown under the title. */
  description: string;
}

export interface MedalCelebrationProps {
  medal: EarnedMedal;
  /** Dismiss handler (button or scrim tap). */
  onClose: () => void;
}

/** One-time celebration modal for a newly earned medal. */
export declare function MedalCelebration(props: MedalCelebrationProps): React.ReactElement;

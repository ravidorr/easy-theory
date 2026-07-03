import * as React from 'react';

export type TabKey = 'home' | 'topics' | 'cards' | 'more';

export interface TabBarProps {
  /** Which tab is highlighted. Default 'home'. */
  active?: TabKey;
  /** Called with the tab key on tap. */
  onNavigate?: (key: TabKey) => void;
  style?: React.CSSProperties;
}

/** Bottom tab bar: הבית · נושאים · כרטיסיות · עוד. Top-level screens only. */
export declare function TabBar(props: TabBarProps): React.ReactElement;

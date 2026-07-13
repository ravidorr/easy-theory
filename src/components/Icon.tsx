import type { ReactElement } from "react";

// Icon data mirrors design-system/icons.svg — update both when adding icons.
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONS = {
  flame: {
    viewBox: "0 0 16 16",
    content: (
      <>
        <path
          d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z"
          fill="currentColor"
        />
        <circle cx="8" cy="10.6" r="2.1" fill="var(--surface)" opacity="0.85" />
      </>
    ),
  },
  star: {
    viewBox: "0 0 16 16",
    content: (
      <path
        d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z"
        fill="currentColor"
      />
    ),
  },
  home: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </g>
    ),
  },
  video: {
    viewBox: "0 0 24 24",
    content: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" {...stroke} />
        <path d="m14 12-4-2.5v5z" fill="currentColor" />
      </>
    ),
  },
  cards: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </g>
    ),
  },
  link: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </g>
    ),
  },
  more: {
    viewBox: "0 0 24 24",
    content: (
      <g fill="currentColor">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </g>
    ),
  },
  calendar: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 9h18" />
      </g>
    ),
  },
  moon: {
    viewBox: "0 0 24 24",
    content: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" {...stroke} />,
  },
  heart: {
    viewBox: "0 0 24 24",
    content: (
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        {...stroke}
      />
    ),
  },
  globe: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </g>
    ),
  },
  "chevron-left": {
    viewBox: "0 0 24 24",
    content: <path d="m15 18-6-6 6-6" {...stroke} stroke="var(--text-faint)" />,
  },
  external: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke} stroke="var(--text-faint)">
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
      </g>
    ),
  },
  play: {
    viewBox: "0 0 24 24",
    content: <path d="M8 5v14l11-7z" fill="#fff" />,
  },
  timer: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <circle cx="12" cy="14" r="8" />
        <path d="M10 2h4" />
        <path d="M12 14l3-3" />
      </g>
    ),
  },
} satisfies Record<string, { viewBox: string; content: ReactElement }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const def = ICONS[name];
  if (!def) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={def.viewBox}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {def.content}
    </svg>
  );
}

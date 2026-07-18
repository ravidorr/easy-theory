import type { ReactElement } from "react";

// Most icon data mirrors design-system/icons.svg (a verbatim design export —
// never hand-edit it). Icons that exist only here (bookmark, close, warning,
// target) are app-side additions awaiting a design-source export.
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
  gem: {
    viewBox: "0 0 16 16",
    content: (
      <>
        <path d="M4.5 2.5h7L14 6 8 13.5 2 6z" fill="currentColor" />
        <path d="M5.2 6.5h5.6L8 10.9z" fill="var(--surface)" opacity="0.85" />
      </>
    ),
  },
  trophy: {
    viewBox: "0 0 16 16",
    content: (
      <>
        <path d="M4.5 1.8h7v4a3.5 3.5 0 0 1-7 0z" fill="currentColor" />
        <path
          d="M4.5 3H2.5v1.5A2.5 2.5 0 0 0 5 7M11.5 3h2v1.5A2.5 2.5 0 0 1 11 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path d="M7 9.3h2v2.2H7z" fill="currentColor" />
        <path d="M4.8 11.5h6.4v1.7H4.8z" fill="currentColor" />
      </>
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
  youtube: {
    viewBox: "0 0 24 24",
    content: (
      <>
        <path
          d="M21.6 7.2a2.9 2.9 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.9 2.9 0 0 0-2 2A30.2 30.2 0 0 0 2 12a30.2 30.2 0 0 0 .4 4.8 2.9 2.9 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.9 2.9 0 0 0 2-2A30.2 30.2 0 0 0 22 12a30.2 30.2 0 0 0-.4-4.8Z"
          fill="currentColor"
        />
        <path d="m10 15.5 5-3.5-5-3.5v7Z" fill="var(--surface)" />
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
  check: {
    viewBox: "0 0 24 24",
    content: <path d="M20 6 9 17l-5-5" {...stroke} strokeWidth={2.5} />,
  },
  close: {
    viewBox: "0 0 24 24",
    content: <path d="M18 6 6 18M6 6l12 12" {...stroke} />,
  },
  warning: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </g>
    ),
  },
  target: {
    viewBox: "0 0 24 24",
    content: (
      <g {...stroke}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </g>
    ),
  },
  bookmark: {
    viewBox: "0 0 24 24",
    content: (
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" {...stroke} />
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

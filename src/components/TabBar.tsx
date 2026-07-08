import Link from "next/link";
import styles from "./TabBar.module.css";

type ActiveTab = "home" | "topics" | "cards" | "more";

export function TabBar({ active }: { active: ActiveTab }) {
  const tabs = [
    {
      key: "home" as ActiveTab,
      href: "/",
      label: "הבית",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
        </svg>
      ),
    },
    {
      key: "topics" as ActiveTab,
      href: "/topics",
      label: "נושאים",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
        </svg>
      ),
    },
    {
      key: "cards" as ActiveTab,
      href: "/flashcards",
      label: "כרטיסיות",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      ),
    },
    {
      key: "more" as ActiveTab,
      href: "/more",
      label: "עוד",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
        </svg>
      ),
    },
  ];

  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={styles.navItem}
          >
            {tab.icon}
            <span className={styles.navLabel}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

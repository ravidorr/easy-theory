import { Link } from "@/lib/navigation";
import { Icon } from "@/components/Icon";
import styles from "./TabBar.module.css";

export type ActiveTab = "home" | "practice" | "exam" | "mistakes" | "progress" | "videos" | "cards" | "links" | "more";

type TabBarLabels = Record<"home" | "practice" | "exam" | "progress" | "more", string>;

export function TabBarContent({
  active,
  current = active,
  labels,
}: {
  active: ActiveTab;
  current?: ActiveTab | null;
  labels: TabBarLabels;
}) {
  const tabs = [
    { key: "home" as ActiveTab, href: "/" as const, label: labels.home, icon: <Icon name="home" size={22} /> },
    { key: "practice" as ActiveTab, href: "/practice" as const, label: labels.practice, icon: <Icon name="cards" size={22} /> },
    { key: "exam" as ActiveTab, href: "/exam" as const, label: labels.exam, icon: <Icon name="timer" size={22} /> },
    { key: "progress" as ActiveTab, href: "/progress" as const, label: labels.progress, icon: <Icon name="chart" size={22} /> },
    { key: "more" as ActiveTab, href: "/more" as const, label: labels.more, icon: <Icon name="more" size={22} /> },
  ];

  return (
    <nav className={styles.nav} data-tab-bar>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const isCurrent = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isCurrent ? "page" : undefined}
            data-active={isActive ? "true" : undefined}
            className={`pressable ${styles.navItem}`}
          >
            <span className={styles.iconPill}>{tab.icon}</span>
            <span className={styles.navLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

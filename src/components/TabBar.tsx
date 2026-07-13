import { Link } from "@/lib/navigation";
import { getTranslations } from "next-intl/server";
import styles from "./TabBar.module.css";

type ActiveTab = "home" | "videos" | "cards" | "links" | "more";

export async function TabBar({ active }: { active: ActiveTab }) {
  const t = await getTranslations("TabBar");

  const tabs = [
    {
      key: "home" as ActiveTab,
      href: "/" as const,
      label: t("home"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
        </svg>
      ),
    },
    {
      key: "videos" as ActiveTab,
      href: "/videos" as const,
      label: t("videos"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3" /><path d="m14 12-4-2.5v5z" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: "cards" as ActiveTab,
      href: "/flashcards" as const,
      label: t("flashcards"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      ),
    },
    {
      key: "links" as ActiveTab,
      href: "/resources" as const,
      label: t("links"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
      ),
    },
    {
      key: "more" as ActiveTab,
      href: "/more" as const,
      label: t("more"),
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
            <span className={styles.navLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import { Link } from "@/lib/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import styles from "./TabBar.module.css";

type ActiveTab = "home" | "videos" | "cards" | "links" | "more";

export async function TabBar({
  active,
  current = active,
}: {
  active: ActiveTab;
  current?: ActiveTab | null;
}) {
  const t = await getTranslations("TabBar");

  const tabs = [
    {
      key: "home" as ActiveTab,
      href: "/" as const,
      label: t("home"),
      icon: <Icon name="home" size={22} />,
    },
    {
      key: "cards" as ActiveTab,
      href: "/flashcards" as const,
      label: t("flashcards"),
      icon: <Icon name="cards" size={22} />,
    },
    {
      key: "videos" as ActiveTab,
      href: "/videos" as const,
      label: t("videos"),
      icon: <Icon name="video" size={22} />,
    },
    {
      key: "links" as ActiveTab,
      href: "/resources" as const,
      label: t("links"),
      icon: <Icon name="link" size={22} />,
    },
    {
      key: "more" as ActiveTab,
      href: "/more" as const,
      label: t("more"),
      icon: <Icon name="more" size={22} />,
    },
  ];

  return (
    <nav className={styles.nav}>
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

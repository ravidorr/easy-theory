"use client";

import { useTranslations } from "next-intl";
import { TabBarContent, type ActiveTab } from "./TabBarContent";

export function ClientTabBar({
  active,
  current = active,
}: {
  active: ActiveTab;
  current?: ActiveTab | null;
}) {
  const t = useTranslations("TabBar");

  return (
    <TabBarContent
      active={active}
      current={current}
      labels={{
        home: t("home"),
        practice: t("practice"),
        exam: t("exam"),
        progress: t("progress"),
        more: t("more"),
      }}
    />
  );
}

import { redirect } from "next/navigation";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getResources, type Resource } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedContent } from "@/lib/content-locale";
import styles from "./page.module.css";

const ExternalIcon = () => <Icon name="external" size={18} className={styles.externalIcon} />;

const iconWrapVariants: Record<Resource["icon_variant"], string> = {
  neutral: styles.iconWrapNeutral,
  primary: styles.iconWrapPrimary,
  success: styles.iconWrapSuccess,
  muted: styles.iconWrapMuted,
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/resources");

  const t = await getTranslations("Resources");
  const locale = await getLocale();
  const loc = (he: string | null, ar: string | null) => localizedContent(locale, he, ar);

  const resources = await getResources(supabase);
  const sections = [
    { title: t("officialTitle"), items: resources.filter((r) => r.section === "official") },
    { title: t("practiceTitle"), items: resources.filter((r) => r.section === "practice") },
  ];

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
          <span className={styles.subtitle}>{t("subtitle")}</span>
        </div>

        {sections.map((section) => (
          <div key={section.title} className={styles.section}>
            <h2>{section.title}</h2>

            {section.items.map((resource) => (
              <a
                key={resource.href}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`pressable-card ${styles.resourceLink}`}
              >
                <div className={`${styles.iconWrap} ${iconWrapVariants[resource.icon_variant]}`}>
                  {resource.icon_type === "sign" ? (
                    <SignImage src={resource.icon_value} size="xs" />
                  ) : (
                    resource.icon_value
                  )}
                </div>
                <div className={styles.resourceBody}>
                  <span className={styles.resourceTitle}>
                    {loc(resource.title_he, resource.title_ar)}
                  </span>
                  <span className={styles.resourceDesc}>
                    {loc(resource.description_he, resource.description_ar)}
                  </span>
                </div>
                <ExternalIcon />
              </a>
            ))}
          </div>
        ))}

        <span className={styles.pageNote}>{t("pageNote")}</span>
      </main>
      <TabBar active="links" />
    </>
  );
}

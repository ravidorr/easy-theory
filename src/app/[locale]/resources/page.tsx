import { redirect } from "next/navigation";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getResources, type Resource } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedContent } from "@/lib/content-locale";
import styles from "./page.module.css";

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
  const [featured, ...officialResources] = resources.filter((resource) => resource.section === "official");
  const sections = [
    { title: t("officialTitle"), featured, items: officialResources },
    {
      title: t("practiceTitle"),
      featured: undefined,
      items: resources.filter((resource) => resource.section === "practice"),
    },
  ];

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
        </div>

        {sections.map((section) => (
          <div key={section.title} className={styles.section}>
            <h2>{section.title}</h2>

            {section.featured && (
              <a
                href={section.featured.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`pressable-card ${styles.featuredLink}`}
                data-testid="featured-resource"
              >
                <div className={styles.featuredVisual}>
                  {section.featured.icon_type === "sign" ? (
                    <SignImage src={section.featured.icon_value} size="md" />
                  ) : (
                    <span className={styles.featuredChar}>{section.featured.icon_value}</span>
                  )}
                </div>
                <div className={styles.featuredBody}>
                  <span className={styles.resourceTitle}>
                    {loc(section.featured.title_he, section.featured.title_ar)}
                  </span>
                  <span className={styles.resourceDesc}>
                    {loc(section.featured.description_he, section.featured.description_ar)}
                  </span>
                </div>
              </a>
            )}

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

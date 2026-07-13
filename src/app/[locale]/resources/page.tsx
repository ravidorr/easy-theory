import { redirect } from "next/navigation";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations } from "next-intl/server";
import styles from "@/app/resources/page.module.css";

const ExternalIcon = () => <Icon name="external" size={18} className={styles.externalIcon} />;

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/resources");

  const t = await getTranslations("Resources");

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
          <span className={styles.subtitle}>{t("subtitle")}</span>
        </div>

        <div className={styles.section}>
          <h2>{t("officialTitle")}</h2>

          <a
            href="https://www.gov.il/he/pages/tamrurim_7924_01_18"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.resourceLink}
          >
            <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
              <SignImage src="/signs/sign-301.png" size="xs" />
            </div>
            <div className={styles.resourceBody}>
              <span className={styles.resourceTitle}>{t("resource1Title")}</span>
              <span className={styles.resourceDesc}>{t("resource1Desc")}</span>
            </div>
            <ExternalIcon />
          </a>

          <a
            href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.resourceLink}
          >
            <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>?</div>
            <div className={styles.resourceBody}>
              <span className={styles.resourceTitle}>{t("resource2Title")}</span>
              <span className={styles.resourceDesc}>{t("resource2Desc")}</span>
            </div>
            <ExternalIcon />
          </a>
        </div>

        <div className={styles.section}>
          <h2>{t("practiceTitle")}</h2>

          <a
            href="https://m.noeg.co.il/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.resourceLink}
          >
            <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>✓</div>
            <div className={styles.resourceBody}>
              <span className={styles.resourceTitle}>{t("resource3Title")}</span>
              <span className={styles.resourceDesc}>{t("resource3Desc")}</span>
            </div>
            <ExternalIcon />
          </a>

          <a
            href="https://he.wikipedia.org/wiki/%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.resourceLink}
          >
            <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>W</div>
            <div className={styles.resourceBody}>
              <span className={styles.resourceTitle}>{t("resource4Title")}</span>
              <span className={styles.resourceDesc}>{t("resource4Desc")}</span>
            </div>
            <ExternalIcon />
          </a>
        </div>

        <span className={styles.pageNote}>{t("pageNote")}</span>
      </main>
      <TabBar active="links" />
    </>
  );
}

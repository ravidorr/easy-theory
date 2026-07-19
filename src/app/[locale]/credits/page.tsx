import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SignImage } from "@/components/SignImage";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";

const ExternalIcon = () => <Icon name="external" size={18} className={styles.externalIcon} />;

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/credits");

  const t = await getTranslations("Credits");

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
          <span className={styles.subtitle}>{t("subtitle")}</span>
        </div>

        <div className={styles.section}>
          <h2>{t("dataSourcesTitle")}</h2>

        <a
          href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>?</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>{t("credit1Title")}</span>
            <span className={styles.resourceDesc}>{t("credit1Desc")}</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://www.gov.il/he/pages/tamrurim_7924_01_18"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
            <SignImage src="/signs/sign-301.png" size="xs" />
          </div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>{t("credit2Title")}</span>
            <span className={styles.resourceDesc}>{t("credit2Desc")}</span>
          </div>
          <ExternalIcon />
        </a>

          <a
            href="https://commons.wikimedia.org/wiki/Category:Road_signs_in_Israel"
            target="_blank"
            rel="noopener noreferrer"
            className={`pressable-card ${styles.resourceLink}`}
          >
            <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>W</div>
            <div className={styles.resourceBody}>
              <span className={styles.resourceTitle}>{t("credit3Title")}</span>
              <span className={styles.resourceDesc}>{t("credit3Desc")}</span>
            </div>
            <ExternalIcon />
          </a>
        </div>

        <div className={styles.section}>
          <h2>{t("builtWithTitle")}</h2>

        <a
          href="https://nextjs.org"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>N</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Next.js</span>
            <span className={styles.resourceDesc}>React framework, App Router, Server Components</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://supabase.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>S</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Supabase</span>
            <span className={styles.resourceDesc}>{t("supabaseDesc")}</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://deepmind.google/technologies/gemini/"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>G</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Google Gemini</span>
            <span className={styles.resourceDesc}>{t("geminiDesc")}</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://fonts.google.com/specimen/Rubik"
          target="_blank"
          rel="noopener noreferrer"
          className={`pressable-card ${styles.resourceLink}`}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>R</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Rubik</span>
            <span className={styles.resourceDesc}>{t("rubikDesc")}</span>
          </div>
          <ExternalIcon />
        </a>
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}

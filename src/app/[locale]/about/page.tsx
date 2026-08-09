import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/components/Icon";
import styles from "./page.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      locale: locale === "ar" ? "ar_IL" : "he_IL",
    },
  };
}

export default async function AboutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ locale }, { next }, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/schedule";
  const loginHref = `/auth/login?next=${encodeURIComponent(safeNext)}#login-card`;
  const screenshotLocale = locale === "ar" ? "ar" : "he";
  const screenshotTheme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const screenshotSrc = (screen: "home" | "quiz" | "cards") =>
    `/landing/screenshot-${screen}-${screenshotLocale}-${screenshotTheme}.png`;
  const [t, about] = await Promise.all([
    getTranslations("Login"),
    getTranslations("About"),
  ]);

  return (
    <main className={styles.page} aria-label={about("pageLabel")}>
      <header className={styles.hero}>
        <h1 className={styles.brandLock}>
          <BrandMark className={styles.brandMark} />
          <span className={styles.wordmark}>{t("heroH1")}</span>
        </h1>
        <p className={styles.tagline}>{t("tagline")}</p>
        <h2 className={styles.heroTitle}>{t("heroH2")}</h2>
        <p className={styles.heroDesc}>{t("heroDesc")}</p>
      </header>

      <section aria-label={t("previewSectionLabel")} className={styles.previewSection}>
        <div className={styles.phoneFrame}>
          <Image
            src={screenshotSrc("home")}
            alt={t("screenshotHomeAlt")}
            width={230}
            height={400}
            className={styles.screenshot}
          />
        </div>
        <div className={styles.trustBadge}>
          <span className={styles.trustBadgeIcon}>
            <Icon name="check" size={16} />
          </span>
          <span>{t("trustBadge")}</span>
        </div>
      </section>

      <section aria-label={t("featuresSectionLabel")} className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>{t("featuresTitle")}</h2>

        <div className={styles.featureCard}>
          <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>
            <Icon name="calendar" size={30} />
          </div>
          <div className={styles.featureBody}>
            <h3 className={styles.featureTitle}>{t("featurePlanTitle")}</h3>
            <p className={styles.featureDesc}>{t("featurePlanDesc")}</p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
            <Image src="/signs/sign-302.png" alt={t("featureQuestionsImgAlt")} width={40} height={40} className={styles.iconImg} />
          </div>
          <div className={styles.featureBody}>
            <h3 className={styles.featureTitle}>{t("featureQuestionsTitle")}</h3>
            <p className={styles.featureDesc}>{t("featureQuestionsDesc")}</p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
            <Image src="/signs/sign-303.png" alt={t("featureCardsImgAlt")} width={40} height={40} className={styles.iconImg} />
          </div>
          <div className={styles.featureBody}>
            <h3 className={styles.featureTitle}>{t("featureCardsTitle")}</h3>
            <p className={styles.featureDesc}>{t("featureCardsDesc")}</p>
          </div>
        </div>
      </section>

      <section aria-label={t("peekTitle")} className={styles.peekSection}>
        <h2 className={styles.sectionTitle}>{t("peekTitle")}</h2>
        <div className={styles.peekRow}>
          <div className={styles.phoneFrameSmall}>
            <Image
              src={screenshotSrc("quiz")}
              alt={t("screenshotQuizAlt")}
              width={170}
              height={300}
              className={styles.screenshot}
            />
          </div>
          <div className={styles.phoneFrameSmall}>
            <Image
              src={screenshotSrc("cards")}
              alt={t("screenshotCardsAlt")}
              width={170}
              height={300}
              className={styles.screenshot}
            />
          </div>
        </div>
      </section>

      <section aria-label={t("faqTitle")} className={styles.faqSection}>
        <h2 className={styles.sectionTitle}>{t("faqTitle")}</h2>
        <div className={styles.faqCard}>
          {([1, 2, 3, 4] as const).map((i) => (
            <div key={i} className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>{t(`faq${i}Q`)}</h3>
              <p className={styles.faqAnswer}>{t(`faq${i}A`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t("closeSectionLabel")}>
        <div className={styles.closeCard}>
          <p className={styles.closeLine}>
            {t("closeLine").split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </p>
          <Link href={loginHref} className="btn-primary">
            {t("closeCta")}
          </Link>
        </div>
      </section>

      <footer>
        <div className={styles.footerBrand}>
          <BrandMark className={styles.footerMark} />
          <span>{t("footerLine1")}</span>
        </div>
        <p>{t("footerLine2")}</p>
      </footer>
    </main>
  );
}

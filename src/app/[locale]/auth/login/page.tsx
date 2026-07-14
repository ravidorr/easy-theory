import type { Metadata } from "next";
import Script from "next/script";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import styles from "./page.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Login" });
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";

  const t = await getTranslations("Login");

  return (
    <>
      <main className={styles.page}>
        <header className={styles.hero}>
          <span className={styles.wordmark}>{t("heroH1")}</span>
          <h1 className={styles.heroTitle}>
            {t("heroH2").split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </h1>
          <p className={styles.heroDesc}>{t("heroDesc")}</p>
        </header>

        <section
          id="login-card"
          aria-label={t("loginSectionLabel")}
          className={styles.loginCard}
        >
          <div id="login-header" className={styles.loginHeader}>
            <h2 className={styles.loginCardTitle}>{t("loginCardTitle")}</h2>
            <p className={styles.loginCardHint}>{t("loginCardHint")}</p>
          </div>

          {error === "1" && (
            <p role="alert" className={styles.loginError}>
              {t("linkExpired")}
            </p>
          )}

          <form id="login-form" className={styles.loginForm}>
            <input type="hidden" id="next-path" value={safeNext} />
            <label className={styles.emailLabel}>
              <span className={styles.emailLabelText}>{t("emailLabel")}</span>
              <input
                type="email"
                name="email"
                id="email-input"
                placeholder={t("emailPlaceholder")}
                dir="ltr"
                autoComplete="email"
                required
                className={styles.emailInput}
              />
            </label>
            <button type="submit" id="send-btn" className="btn-primary">
              {t("sendBtn")}
            </button>
            <p
              id="login-error"
              role="alert"
              className={`${styles.loginError} ${styles.hidden}`}
            />
          </form>

          <div
            id="sent-banner"
            className={`${styles.sentCard} ${styles.hidden}`}
          >
            <span className={styles.sentIcon}>
              <Icon name="check" size={24} />
            </span>
            <h3 className={styles.sentTitle}>{t("sentTitle")}</h3>
            <p className={styles.sentHint}>
              {t("sentHint")}
              {" "}{t("sentSpamHint")}
              <br />
              {t("sentHintBrowser")}
            </p>
            <button id="resend-btn" className={styles.resendBtn}>
              {t("resendBtn")}
            </button>
            <span
              id="resend-msg"
              className={`${styles.resendMsg} ${styles.hidden}`}
            />
          </div>
        </section>

        <section
          aria-label={t("previewSectionLabel")}
          className={styles.previewSection}
        >
          <div className={styles.trustBadge}>
            <span className={styles.trustBadgeIcon}>
              <Icon name="check" size={16} />
            </span>
            <span>{t("trustBadge")}</span>
          </div>
          <div className={styles.phoneFrame}>
            <Image
              src="/landing/screenshot-home.png"
              alt={t("screenshotHomeAlt")}
              width={230}
              height={400}
              className={styles.screenshot}
            />
          </div>
        </section>

        <section
          aria-label={t("featuresSectionLabel")}
          className={styles.featuresSection}
        >
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
                src="/landing/screenshot-quiz.png"
                alt={t("screenshotQuizAlt")}
                width={170}
                height={300}
                className={styles.screenshot}
              />
            </div>
            <div className={styles.phoneFrameSmall}>
              <Image
                src="/landing/screenshot-cards.png"
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
            <a href="#login-card" className="btn-primary">
              {t("closeCta")}
            </a>
          </div>
        </section>

        <footer>
          <p>{t("footerLine1")}</p>
          <p>{t("footerLine2")}</p>
        </footer>
      </main>

      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}

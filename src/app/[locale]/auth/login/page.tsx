import type { Metadata } from "next";
import Script from "next/script";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import styles from "@/app/auth/login/page.module.css";

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
        <header>
          <div className={styles.heroCard}>
            <h1>{t("heroH1")}</h1>
            <h2 className={styles.heroH2}>
              {t("heroH2").split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && <br />}
                </span>
              ))}
            </h2>
            <p className={styles.heroDesc}>{t("heroDesc")}</p>
          </div>
        </header>

        <section aria-label={t("loginSectionLabel")} className={styles.loginCard}>
          <div className={styles.loginHeader}>
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
            className={`${styles.sentBanner} ${styles.hidden}`}
          >
            <span className={styles.sentIcon}>✓</span>
            <div className={styles.sentBody}>
              <h3 className={styles.sentTitle}>{t("sentTitle")}</h3>
              <p className={styles.sentHint}>
                {t("sentHint")}
                {" "}{t("sentHintBrowser")}
              </p>
              <p className={styles.resendRow}>
                {t("resendQuestion")}{" "}
                <button id="resend-btn" className={styles.resendBtn}>
                  {t("resendBtn")}
                </button>
                {" "}
                <span id="resend-msg" className={`${styles.resendMsg} ${styles.hidden}`} />
              </p>
            </div>
          </div>
        </section>

        <section aria-label={t("featuresSectionLabel")} className={styles.featuresSection}>
          <h2 className={styles.sectionTitle}>{t("featuresTitle")}</h2>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/signs/sign-302.png" alt={t("feature1ImgAlt")} className={styles.iconImg} />
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>{t("feature1Title")}</h3>
              <p className={styles.featureDesc}>{t("feature1Desc")}</p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/signs/sign-303.png" alt={t("feature2ImgAlt")} className={styles.iconImg} />
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>{t("feature2Title")}</h3>
              <p className={styles.featureDesc}>{t("feature2Desc")}</p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>
              <Icon name="calendar" size={26} />
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>{t("feature3Title")}</h3>
              <p className={styles.featureDesc}>{t("feature3Desc")}</p>
            </div>
          </div>
        </section>

        <section aria-label={t("reassuranceSectionLabel")}>
          <div className={styles.reassurance}>
            <h2 className={styles.reassuranceTitle}>{t("reassuranceTitle")}</h2>
            <p className={styles.reassuranceDesc}>{t("reassuranceDesc")}</p>
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

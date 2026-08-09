import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import { BrandMark } from "@/components/BrandMark";
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
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }] = await Promise.all([searchParams, params]);
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/schedule";
  const aboutHref = `/about?next=${encodeURIComponent(safeNext)}`;
  const t = await getTranslations("Login");

  return (
    <>
      <main className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.brandLock}>
            <BrandMark className={styles.brandMark} />
            <span className={styles.wordmark}>{t("heroH1")}</span>
          </h1>
          <p className={styles.tagline}>{t("tagline")}</p>
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
          <Link href={aboutHref} className={styles.aboutLink}>
            {t("aboutLink")}
          </Link>

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
            <button id="resend-btn" className={`pressable ${styles.resendBtn}`}>
              {t("resendBtn")}
            </button>
            <span
              id="resend-msg"
              className={`${styles.resendMsg} ${styles.hidden}`}
            />
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

      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}

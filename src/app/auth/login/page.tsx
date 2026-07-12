import type { Metadata } from "next";
import Script from "next/script";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "דרך ברורה — לומדים לתיאוריה בלי לחץ",
  description:
    "אפליקציה חינמית ללימוד מבחן התיאוריה בישראל: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות תמרורים ותוכנית אישית בקצב שלך.",
  openGraph: {
    title: "דרך ברורה — לומדים לתיאוריה בלי לחץ",
    description:
      "אפליקציה חינמית ללימוד מבחן התיאוריה בישראל: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות תמרורים ותוכנית אישית בקצב שלך.",
    locale: "he_IL",
  },
};

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

  return (
    <>
      <main className={styles.page}>
        {/* Hero */}
        <header>
          <div className={styles.heroCard}>
            <h1>דרך ברורה</h1>
            <h2 className={styles.heroH2}>
              לומדים לתיאוריה,
              <br />
              בלי לחץ.
            </h2>
            <p className={styles.heroDesc}>
              כל מה שצריך למבחן התיאוריה: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות
              תמרורים ותוכנית שמתאימה את עצמה לקצב שלך.
            </p>
          </div>
        </header>

        {/* Login card */}
        <section aria-label="כניסה" className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <h2 className={styles.loginCardTitle}>להתחיל עכשיו</h2>
            <p className={styles.loginCardHint}>להתחברות עם קישור למייל, בלי סיסמה. חינם לגמרי.</p>
          </div>

          {error === '1' && (
            <p role="alert" className={styles.loginError}>
              הקישור פג תוקף או כבר נוצל. אנא בקשי קישור חדש.
            </p>
          )}

          <form id="login-form" className={styles.loginForm}>
            <input type="hidden" id="next-path" value={safeNext} />
            <label className={styles.emailLabel}>
              <span className={styles.emailLabelText}>כתובת המייל שלך</span>
              <input
                type="email"
                name="email"
                id="email-input"
                placeholder="noa@example.com"
                dir="ltr"
                autoComplete="email"
                required
                className={styles.emailInput}
              />
            </label>
            <button type="submit" id="send-btn" className="btn-primary">
              שלחי לי קישור
            </button>
            <p
              id="login-error"
              role="alert"
              className={`${styles.loginError} ${styles.hidden}`}
            />
          </form>

          {/* Sent state — hidden until auth.js reveals it */}
          <div
            id="sent-banner"
            className={`${styles.sentBanner} ${styles.hidden}`}
          >
            <span className={styles.sentIcon}>✓</span>
            <div className={styles.sentBody}>
              <h3 className={styles.sentTitle}>הקישור בדרך אלייך</h3>
              <p className={styles.sentHint}>
                יש ללחוץ על הקישור כדי להיכנס.
                {" "}חשוב: יש לפתוח את הקישור <strong>בדפדפן הזה</strong>.
              </p>
              <p className={styles.resendRow}>
                לא קיבלת?{" "}
                <button id="resend-btn" className={styles.resendBtn}>
                  נשלח שוב
                </button>
                {" "}
                <span id="resend-msg" className={`${styles.resendMsg} ${styles.hidden}`} />
              </p>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section aria-label="מה מקבלים" className={styles.featuresSection}>
          <h2 className={styles.sectionTitle}>מה מחכה לך בפנים</h2>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/signs/sign-302.png"
                alt="תמרור עצור"
                className={styles.iconImg}
              />
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>שאלות אמיתיות מהמבחן</h3>
              <p className={styles.featureDesc}>
                כל השאלות מהמאגר הרשמי של משרד התחבורה, עם הסבר לכל תשובה.
              </p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapNeutral}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/signs/sign-303.png"
                alt="תמרור מעגל תנועה"
                className={styles.iconImg}
              />
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>כרטיסיות תמרורים</h3>
              <p className={styles.featureDesc}>
                שינון תמרורים בשיטת חזרה מרווחת, מה שלא נזכר יחזור מחר.
              </p>
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <path d="M8 2v4M16 2v4M3 9h18" />
              </svg>
            </div>
            <div className={styles.featureBody}>
              <h3 className={styles.featureTitle}>תוכנית אישית בקצב שלך</h3>
              <p className={styles.featureDesc}>
                בימים ושעות שנוח לך, והאפליקציה בונה תוכנית עד למבחן. בלי לחץ, ובלי ספירה לאחור.
              </p>
            </div>
          </div>
        </section>

        {/* Reassurance strip */}
        <section aria-label="בקצרה">
          <div className={styles.reassurance}>
            <h2 className={styles.reassuranceTitle}>חינם, בעברית, בגובה העיניים.</h2>
            <p className={styles.reassuranceDesc}>נבנה בשביל הנהגות והנהגים שבדרך.</p>
          </div>
        </section>

        <footer>
          <p>ClearRoad · דרך ברורה</p>
          <p>לימוד לתיאוריה לרכב פרטי בישראל</p>
        </footer>
      </main>

      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}

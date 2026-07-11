import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { SignImage } from "@/components/SignImage";
import styles from "./page.module.css";

const ExternalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.externalIcon}>
    <path d="M7 7h10v10" /><path d="M7 17 17 7" />
  </svg>
);

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/credits");

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/more" className={styles.backBtn}>→</Link>
        <div className={styles.titleCol}>
          <h1>קרדיטים</h1>
          <span className={styles.subtitle}>האנשים, הכלים והנתונים שמאחורי האפליקציה.</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2>מקורות נתונים</h2>

        <a
          href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>?</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>מאגר שאלות התיאוריה</span>
            <span className={styles.resourceDesc}>1,802 שאלות רשמיות — data.gov.il, משרד התחבורה</span>
          </div>
          <ExternalIcon />
        </a>

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
            <span className={styles.resourceTitle}>ספר התמרורים הרשמי</span>
            <span className={styles.resourceDesc}>לות״ם, משרד התחבורה — ספטמבר 2022</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://commons.wikimedia.org/wiki/Road_signs_in_Israel"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>W</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Wikimedia Commons</span>
            <span className={styles.resourceDesc}>קבצי SVG איכותיים של תמרורי הדרך בישראל</span>
          </div>
          <ExternalIcon />
        </a>
      </div>

      <div className={styles.section}>
        <h2>נבנה עם</h2>

        <a
          href="https://nextjs.org"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
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
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>S</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Supabase</span>
            <span className={styles.resourceDesc}>בסיס נתונים ואימות משתמשים</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://deepmind.google/technologies/gemini/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>G</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Google Gemini</span>
            <span className={styles.resourceDesc}>הסברים חכמים לשאלות שגויות</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://fonts.google.com/specimen/Rubik"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>R</div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>Rubik</span>
            <span className={styles.resourceDesc}>גופן עברי ולטיני — Google Fonts</span>
          </div>
          <ExternalIcon />
        </a>
      </div>

      <span className={styles.pageNote}>© 2026 Raanan Avidor · קוד פתוח</span>
    </main>
  );
}

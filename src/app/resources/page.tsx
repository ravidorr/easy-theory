import { redirect } from "next/navigation";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import styles from "./page.module.css";

const ExternalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.externalIcon}>
    <path d="M7 7h10v10" /><path d="M7 17 17 7" />
  </svg>
);

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/resources");

  return (
    <>
    <main className={styles.page}>
      <div>
        <h1>חומרים שימושיים</h1>
        <span className={styles.subtitle}>מקורות רשמיים ואתרי תרגול, הכל במקום אחד.</span>
      </div>

      {/* Official sources */}
      <div className={styles.section}>
        <h2>מקורות רשמיים</h2>

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
            <span className={styles.resourceTitle}>לוח התמרורים הרשמי</span>
            <span className={styles.resourceDesc}>כל התמרורים בתוקף, משרד התחבורה</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapPrimary}`}>
            ?
          </div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>מאגר שאלות התיאוריה</span>
            <span className={styles.resourceDesc}>יותר מ-1,800 שאלות אמיתיות מהמבחן</span>
          </div>
          <ExternalIcon />
        </a>
      </div>

      {/* Practice & reference */}
      <div className={styles.section}>
        <h2>תרגול והעשרה</h2>

        <a
          href="https://m.noeg.co.il/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>
            ✓
          </div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>נוהג, סימולטור תרגול</span>
            <span className={styles.resourceDesc}>מבחני דמה בתנאי אמת, בחינם</span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://he.wikipedia.org/wiki/%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.resourceLink}
        >
          <div className={`${styles.iconWrap} ${styles.iconWrapMuted}`}>
            W
          </div>
          <div className={styles.resourceBody}>
            <span className={styles.resourceTitle}>ויקיפדיה: תמרורים בישראל</span>
            <span className={styles.resourceDesc}>קטלוג מסודר של כל התמרורים לפי סוג</span>
          </div>
          <ExternalIcon />
        </a>
      </div>

      <span className={styles.pageNote}>הקישורים נפתחים בחלון חדש</span>
    </main>
    <TabBar active="links" />
    </>
  );
}

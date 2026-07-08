import { redirect } from "next/navigation";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { getUserMedals, getUserStats } from "@/lib/db";
import styles from "./page.module.css";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [medals, stats] = await Promise.all([
    getUserMedals(supabase, user.id),
    getUserStats(supabase, user.id),
  ]);
  const earnedSet = new Set(medals.map((m) => m.medal_slug));
  const earnedDateMap = Object.fromEntries(medals.map((m) => [m.medal_slug, m.earned_at]));

  const cookieStore = await cookies();
  const isDark = (cookieStore.get("theme")?.value ?? "dark") === "dark";

  const MILESTONES = [
    { slug: "streak-3",  label: "3 ימים",   emoji: "🔥" },
    { slug: "streak-7",  label: "שבוע",      emoji: "⭐" },
    { slug: "streak-14", label: "שבועיים",   emoji: "💎" },
    { slug: "streak-30", label: "חודש",      emoji: "🏆" },
  ];

  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(iso));
  }

  return (
    <>
      <main className={styles.page}>
        <h1>עוד</h1>

        {/* Stats summary */}
        <div className={styles.statsCard}>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconStreak}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </span>
            <span className={styles.statValue}>{stats.streak_days}</span>
            <span className={styles.statLabel}>יום רצף</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconPoints}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </span>
            <span className={styles.statValue}>{stats.star_points}</span>
            <span className={styles.statLabel}>נקודות</span>
          </div>
        </div>

        {/* Navigation rows */}
        <div className={styles.navCard}>
          <a href="/schedule" className={styles.navRow}>
            <span className={styles.navIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 9h18" />
              </svg>
            </span>
            <span className={styles.navRowLabel}>התוכנית שלך</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navChevron}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </a>


        </div>

        {/* Medals */}
        <div className={styles.medalsCard}>
          <h2>הישגים</h2>
          <div className={styles.medalsGrid}>
            {MILESTONES.map(({ slug, label, emoji }) => {
              const earned = earnedSet.has(slug);
              const date = earnedDateMap[slug];
              return (
                <div key={slug} className={styles.medalItem}>
                  <div className={`${styles.medal} ${earned ? styles.medalEarned : ""}`}>
                    {emoji}
                  </div>
                  <span className={`${styles.medalLabel} ${earned ? styles.medalLabelEarned : ""}`}>
                    {label}
                  </span>
                  <span className={`${styles.medalDate} ${earned ? styles.medalDateEarned : ""}`}>
                    {earned ? fmtDate(date) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className={styles.settingsCard}>
          <label className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            </span>
            <span className={styles.settingsRowLabel}>מצב כהה</span>
            <span
              id="dark-mode-toggle"
              role="switch"
              aria-checked={isDark ? "true" : "false"}
              className={`${styles.toggle} ${isDark ? styles.toggleOn : ""}`}
            >
              <span className={`${styles.toggleThumb} ${isDark ? styles.toggleThumbOn : ""}`} />
            </span>
          </label>
        </div>

        <button id="logout-btn" className={styles.logoutBtn}>
          יציאה מהחשבון
        </button>
      </main>

      <TabBar active="more" />
      <Script src="/js/more.js" strategy="afterInteractive" />
    </>
  );
}

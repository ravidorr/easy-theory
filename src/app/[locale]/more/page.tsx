import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { getUserMedals, getUserStats } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import styles from "@/app/more/page.module.css";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/more");

  const locale = await getLocale();
  const t = await getTranslations("More");

  const [medals, stats] = await Promise.all([
    getUserMedals(supabase, user.id),
    getUserStats(supabase, user.id),
  ]);
  const earnedSet = new Set(medals.map((m) => m.medal_slug));
  const earnedDateMap = Object.fromEntries(medals.map((m) => [m.medal_slug, m.earned_at]));

  const cookieStore = await cookies();
  const isDark = (cookieStore.get("theme")?.value ?? "dark") === "dark";

  const MILESTONES = [
    { slug: "streak-3", label: t("milestone3"), emoji: "🔥" },
    { slug: "streak-7", label: t("milestone7"), emoji: "⭐" },
    { slug: "streak-14", label: t("milestone14"), emoji: "💎" },
    { slug: "streak-30", label: t("milestone30"), emoji: "🏆" },
  ];

  const dateLocale = locale === "ar" ? "ar-IL" : "he-IL";

  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short" }).format(
      new Date(iso)
    );
  }

  return (
    <>
      <main className={styles.page}>
        <h1>{t("pageTitle")}</h1>

        <div className={styles.statsCard}>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconStreak}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </span>
            <span className={styles.statValue}>{stats.streak_days}</span>
            <span className={styles.statLabel}>{t("statStreak")}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconPoints}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </span>
            <span className={styles.statValue}>{stats.star_points}</span>
            <span className={styles.statLabel}>{t("statPoints")}</span>
          </div>
        </div>

        <div className={styles.navCard}>
          <Link href="/schedule" className={`${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 9h18" />
              </svg>
            </span>
            <span className={styles.navRowLabel}>{t("navSchedule")}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navChevron}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>

          <Link href="/credits" className={styles.navRow}>
            <span className={styles.navIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </span>
            <span className={styles.navRowLabel}>{t("navCredits")}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navChevron}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        </div>

        <div className={styles.medalsCard}>
          <h2>{t("medalsTitle")}</h2>
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

        <div className={styles.settingsCard}>
          <label className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            </span>
            <span className={styles.settingsRowLabel}>{t("darkMode")}</span>
            <span
              id="dark-mode-toggle"
              role="switch"
              aria-checked={isDark ? "true" : "false"}
              className={`${styles.toggle} ${isDark ? styles.toggleOn : ""}`}
            >
              <span className={`${styles.toggleThumb} ${isDark ? styles.toggleThumbOn : ""}`} />
            </span>
          </label>

          <div className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <span className={styles.settingsRowLabel}>{t("language")}</span>
            <LanguageToggle />
          </div>
        </div>

        <button id="logout-btn" className={styles.logoutBtn}>
          {t("logoutBtn")}
        </button>
      </main>

      <TabBar active="more" />
      <Script src="/js/more.js" strategy="afterInteractive" />
    </>
  );
}

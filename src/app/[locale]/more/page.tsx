import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { Icon, type IconName } from "@/components/Icon";
import { getUserMedals, getUserStats } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import styles from "./page.module.css";

export default async function MorePage() {
  noStore();
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
  // Default is on; more.js corrects the default for reduced-motion users.
  const autoAdvanceOn = cookieStore.get("quiz-auto-advance")?.value !== "off";

  const MILESTONES: { slug: string; label: string; icon: IconName }[] = [
    { slug: "streak-3", label: t("milestone3"), icon: "flame" },
    { slug: "streak-7", label: t("milestone7"), icon: "star" },
    { slug: "streak-14", label: t("milestone14"), icon: "gem" },
    { slug: "streak-30", label: t("milestone30"), icon: "trophy" },
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
              <Icon name="flame" size={18} />
            </span>
            <span className={styles.statValue} data-stat="streak">{stats.streak_days}</span>
            <span className={styles.statLabel}>{t("statStreak")}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconPoints}`}>
              <Icon name="star" size={18} />
            </span>
            <span className={styles.statValue} data-stat="points">{stats.star_points}</span>
            <span className={styles.statLabel}>{t("statPoints")}</span>
          </div>
        </div>

        <div className={styles.navCard}>
          <Link href="/exam" className={`${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="timer" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navExam")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/schedule" className={`${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="calendar" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navSchedule")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/bookmarks" className={`${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="bookmark" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navBookmarks")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/credits" className={styles.navRow}>
            <span className={styles.navIcon}>
              <Icon name="heart" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navCredits")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>
        </div>

        <div className={styles.medalsCard}>
          <h2>{t("medalsTitle")}</h2>
          <div className={styles.medalsGrid}>
            {MILESTONES.map(({ slug, label, icon }) => {
              const earned = earnedSet.has(slug);
              const date = earnedDateMap[slug];
              return (
                <div key={slug} className={styles.medalItem}>
                  <div className={`${styles.medal} ${earned ? styles.medalEarned : ""}`}>
                    <Icon name={icon} size={24} />
                  </div>
                  <span className={`${styles.medalLabel} ${earned ? styles.medalLabelEarned : ""}`}>
                    {label}
                  </span>
                  <span className={`${styles.medalDate} ${earned ? styles.medalDateEarned : ""}`}>
                    {earned ? fmtDate(date) : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.settingsCard}>
          <label className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="moon" size={20} />
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

          <label className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="play" size={20} />
            </span>
            <span className={styles.settingsRowLabel}>{t("autoAdvance")}</span>
            <span
              id="auto-advance-toggle"
              role="switch"
              aria-checked={autoAdvanceOn ? "true" : "false"}
              className={`${styles.toggle} ${autoAdvanceOn ? styles.toggleOn : ""}`}
            >
              <span
                className={`${styles.toggleThumb} ${autoAdvanceOn ? styles.toggleThumbOn : ""}`}
              />
            </span>
          </label>

          <div className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="globe" size={20} />
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
      <Script src="/js/stats-pills.js" strategy="afterInteractive" />
    </>
  );
}

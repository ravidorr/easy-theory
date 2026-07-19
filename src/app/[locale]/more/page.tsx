import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { Icon, type IconName } from "@/components/Icon";
import {
  getUserMedals,
  getUserStats,
  getTopics,
  getTopicAccuracy,
  getTopicQuestionCounts,
} from "@/lib/db";
import {
  completionSummary,
  LEVEL_CURVE_UNIT,
  levelForPoints,
  overallAccuracy,
} from "@/lib/gamification";
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

  const [medals, stats, topics, topicAccuracy, questionCounts] =
    await Promise.all([
      getUserMedals(supabase, user.id),
      getUserStats(supabase, user.id),
      getTopics(supabase),
      getTopicAccuracy(supabase, user.id),
      getTopicQuestionCounts(supabase),
    ]);
  const earnedSet = new Set(medals.map((m) => m.medal_slug));
  const earnedDateMap = Object.fromEntries(medals.map((m) => [m.medal_slug, m.earned_at]));

  const answeredMap = Object.fromEntries(topicAccuracy.map((a) => [a.topic_id, a.total]));
  const completion = completionSummary(
    topics.map((topic) => topic.id),
    questionCounts,
    answeredMap
  );
  const accuracy = overallAccuracy(topicAccuracy);
  const levelInfo = levelForPoints(stats.star_points);

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

  const ACHIEVEMENT_META: Record<string, { label: string; icon: IconName }> = {
    "first-topic": { label: t("achFirstTopic"), icon: "check" },
    "questions-100": { label: t("achQuestions100"), icon: "cards" },
    "all-topics": { label: t("achAllTopics"), icon: "globe" },
    "exam-pass": { label: t("achExamPass"), icon: "timer" },
  };

  const dateLocale = locale === "ar" ? "ar-IL" : "he-IL";

  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short" }).format(
      new Date(iso)
    );
  }

  // Every medal is an immutable earn event; this prevents a later topic-bank
  // expansion from taking an already-earned achievement away.
  const medalItems = [
    ...MILESTONES.map(({ slug, label, icon }) => {
      const earned = earnedSet.has(slug);
      return {
        slug,
        label,
        icon,
        earned,
        dateText: earned ? fmtDate(earnedDateMap[slug]) : t("medalLockedLabel"),
      };
    }),
    ...Object.entries(ACHIEVEMENT_META).map(([slug, meta]) => {
      const earned = earnedSet.has(slug);
      return {
      slug,
      label: meta.label,
      icon: meta.icon,
      earned,
      dateText: earned ? fmtDate(earnedDateMap[slug]) : t("medalLockedLabel"),
      };
    }),
  ];

  return (
    <>
      <main className={styles.page}>
        <h1>{t("pageTitle")}</h1>
        <p className={styles.subtitle}>{t("pageSubtitle")}</p>

        <div className={styles.statsCard}>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconStreak}`}>
              <Icon name="flame" size={18} />
            </span>
            <span className={styles.statValue} data-stat="streak">{stats.streak_days}</span>
            <span className={styles.statLabel}>{t("statStreak")}</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconPoints}`}>
              <Icon name="star" size={18} />
            </span>
            <span className={styles.statValue} data-stat="points">{stats.star_points}</span>
            <span className={styles.statLabel}>{t("statPoints")}</span>
          </div>
          <div className={styles.statCell} data-level-unit={LEVEL_CURVE_UNIT}>
            <span className={`${styles.statIcon} ${styles.statIconLevel}`}>
              <Icon name="gem" size={18} />
            </span>
            <span className={styles.statValue} data-stat="level">{levelInfo.level}</span>
            <span className={styles.statLabel}>{t("statLevel")}</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconNeutral}`}>
              <Icon name="check" size={18} />
            </span>
            <span
              className={
                accuracy === null
                  ? `${styles.statValue} ${styles.statValueEmpty}`
                  : styles.statValue
              }
            >
              {accuracy === null
                ? t("statAccuracyEmpty")
                : t("statAccuracyValue", { percent: accuracy })}
            </span>
            <span className={styles.statLabel}>{t("statAccuracy")}</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconNeutral}`}>
              <Icon name="cards" size={18} />
            </span>
            <span className={styles.statValue}>{completion.answeredQuestions}</span>
            <span className={styles.statLabel}>{t("statAnswered")}</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statIcon} ${styles.statIconNeutral}`}>
              <Icon name="trophy" size={18} />
            </span>
            <span className={styles.statValue}>
              {t("statCompletionValue", { percent: completion.percent })}
            </span>
            <span className={styles.statLabel}>{t("statCompletion")}</span>
          </div>
        </div>

        <div className={styles.navCard}>
          <Link href="/exam" className={`pressable-row ${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="timer" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navExam")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/schedule" className={`pressable-row ${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="calendar" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navSchedule")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/bookmarks" className={`pressable-row ${styles.navRow} ${styles.navRowBordered}`}>
            <span className={styles.navIcon}>
              <Icon name="bookmark" size={20} />
            </span>
            <span className={styles.navRowLabel}>{t("navBookmarks")}</span>
            <Icon name="chevron-left" size={18} className={styles.navChevron} />
          </Link>

          <Link href="/credits" className={`pressable-row ${styles.navRow}`}>
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
            {medalItems.map(({ slug, label, icon, earned, dateText }) => (
              <div key={slug} className={styles.medalItem}>
                <div className={`${styles.medal} ${earned ? styles.medalEarned : ""}`}>
                  <Icon name={icon} size={24} />
                </div>
                <span className={`${styles.medalLabel} ${earned ? styles.medalLabelEarned : ""}`}>
                  {label}
                </span>
                <span className={`${styles.medalDate} ${earned ? styles.medalDateEarned : ""}`}>
                  {dateText}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="moon" size={20} />
            </span>
            <span className={styles.settingsRowLabel}>{t("darkMode")}</span>
            <button
              type="button"
              id="dark-mode-toggle"
              role="switch"
              aria-checked={isDark ? "true" : "false"}
              className={`pressable ${styles.toggle} ${isDark ? styles.toggleOn : ""}`}
            >
              <span className={`${styles.toggleThumb} ${isDark ? styles.toggleThumbOn : ""}`} />
            </button>
          </div>

          <div className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="play" size={20} />
            </span>
            <span className={styles.settingsRowLabel}>{t("autoAdvance")}</span>
            <button
              type="button"
              id="auto-advance-toggle"
              role="switch"
              aria-checked={autoAdvanceOn ? "true" : "false"}
              className={`pressable ${styles.toggle} ${autoAdvanceOn ? styles.toggleOn : ""}`}
            >
              <span
                className={`${styles.toggleThumb} ${autoAdvanceOn ? styles.toggleThumbOn : ""}`}
              />
            </button>
          </div>

          <div className={styles.settingsRow}>
            <span className={styles.settingsIcon}>
              <Icon name="globe" size={20} />
            </span>
            <span className={styles.settingsRowLabel}>{t("language")}</span>
            <LanguageToggle />
          </div>
        </div>

        <button id="logout-btn" className={`btn-danger ${styles.logoutBtn}`}>
          {t("logoutBtn")}
        </button>
      </main>

      <TabBar active="more" />
      <Script src="/js/more.js" strategy="afterInteractive" />
      <Script src="/js/stats-pills.js" strategy="afterInteractive" />
    </>
  );
}

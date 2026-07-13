import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getUserStats,
  getTopicProgress,
  getExamAttempts,
  getTopicAccuracy,
} from "@/lib/db";
import { nextMedalTarget } from "@/lib/quiz";
import { computeReadiness, findWeakestTopics, READINESS_MAX_ATTEMPTS } from "@/lib/readiness";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations, getLocale } from "next-intl/server";
import styles from "@/app/page.module.css";

function PathProgress({ total = 5, current = 1 }: { total?: number; current?: number }) {
  const items = [];
  for (let i = 1; i <= total; i++) {
    const done = i < current;
    const active = i === current;
    items.push(
      <span
        key={`s${i}`}
        className={`${styles.stepNode} ${done ? styles.stepNodeDone : ""} ${active ? styles.stepNodeActive : ""}`}
        data-active={active || undefined}
      >
        {done ? "✓" : i === total ? "🏁" : i}
      </span>
    );
    if (i < total) {
      items.push(
        <span
          key={`c${i}`}
          className={`${styles.connector} ${i < current ? styles.connectorDone : ""}`}
        />
      );
    }
  }
  return <div className={styles.pathProgress}>{items}</div>;
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getTranslations("Home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/");

  const [stats, topics, progressRows, examAttempts, topicAccuracy] = await Promise.all([
    getUserStats(supabase, user.id),
    getTopics(supabase),
    getTopicProgress(supabase, user.id),
    getExamAttempts(supabase, user.id, READINESS_MAX_ATTEMPTS),
    getTopicAccuracy(supabase, user.id),
  ]);

  const progressMap = Object.fromEntries(progressRows.map((p) => [p.topic_id, p]));

  const readiness = computeReadiness(examAttempts);
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const weakTopics = findWeakestTopics(topicAccuracy).flatMap((weak) => {
    const topic = topicsById.get(weak.topic_id);
    return topic ? [{ ...weak, topic }] : [];
  });

  const todayTopic =
    topics.find((t) => progressMap[t.id]?.status === "in_progress") ??
    topics.find((t) => !progressMap[t.id] || progressMap[t.id].status === "not_started") ??
    null;

  const completedCount = progressRows.filter((p) => p.status === "completed").length;

  const MEDAL_EMOJI: Record<number, string> = { 3: "🔥", 7: "⭐", 14: "💎", 30: "🏆" };
  const nextMedal = nextMedalTarget(stats.streak_days);
  const daysToNextMedal = nextMedal !== null ? nextMedal - stats.streak_days : null;

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return t("greetingMorning");
    if (h < 17) return t("greetingNoon");
    return t("greetingEvening");
  }

  const nameField = locale === "ar" ? "name_ar" : "name_he";
  const descField = locale === "ar" ? "description_ar" : "description_he";

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topBar}>
          <span className={styles.wordmark}>{t("wordmark")}</span>
          <div className={styles.pillsRow}>
            <span className={`${styles.pill} ${styles.pillStreak}`}>
              <Icon name="flame" size={15} />
              {stats.streak_days}
            </span>
            <span className={`${styles.pill} ${styles.pillPoints}`}>
              <Icon name="star" size={15} />
              {stats.star_points}
            </span>
          </div>
        </div>

        <div className={styles.greeting}>
          <h1>{timeGreeting()}!</h1>
          <span className={styles.greetingText}>
            {stats.streak_days === 0
              ? t("streakZero")
              : stats.streak_days === 1
              ? t("streakOne")
              : t("streakMany", { count: stats.streak_days })}
          </span>
          {daysToNextMedal !== null ? (
            <span className={styles.medalNudge}>
              {daysToNextMedal === 1
                ? t("daysToMedalOne", { medal: MEDAL_EMOJI[nextMedal!] })
                : t("daysToMedalMany", { count: daysToNextMedal, medal: MEDAL_EMOJI[nextMedal!] })}
            </span>
          ) : stats.streak_days >= 30 ? (
            <span className={styles.medalNudge}>{t("allMedals")}</span>
          ) : null}
        </div>

        {todayTopic ? (
          <div className={styles.todayCard}>
            <span className={styles.todayBadge}>{t("todayBadge")}</span>
            <div className={styles.todayTaskInfo}>
              <h2>{(todayTopic as Record<string, unknown>)[nameField] as string ?? todayTopic.name_he}</h2>
              <span className={styles.todayTaskDesc}>{t("todayTaskDesc")}</span>
            </div>
            {(() => {
              const pct = progressMap[todayTopic.id]?.best_score ?? 0;
              const current = pct >= 100 ? 6 : pct >= 67 ? 4 : pct >= 34 ? 3 : pct >= 1 ? 2 : 1;
              return <PathProgress total={5} current={current} />;
            })()}
            <Link href={`/topics/${todayTopic.slug}`} className={styles.noUnderline}>
              <button className="btn-primary">{t("startBtn")}</button>
            </Link>
          </div>
        ) : (
          <div className={styles.emptyStateCard}>
            <h2>{t("emptyStateTitle")}</h2>
            <span className={styles.emptyCardDesc}>{t("emptyStateDesc")}</span>
            <Link href="/schedule" className={styles.noUnderline}>
              <button className="btn-primary">{t("emptyStateBtn")}</button>
            </Link>
          </div>
        )}

        <div className={styles.readinessCard}>
          <div className={styles.readinessHeader}>
            <span className={styles.readinessTitle}>{t("readinessTitle")}</span>
            {readiness.level === "high" ? (
              <span className={`${styles.readinessChip} ${styles.readinessChipHigh}`}>
                {t("readinessLevelHigh")}
              </span>
            ) : readiness.level === "medium" ? (
              <span className={`${styles.readinessChip} ${styles.readinessChipMedium}`}>
                {t("readinessLevelMedium")}
              </span>
            ) : readiness.level === "low" ? (
              <span className={`${styles.readinessChip} ${styles.readinessChipLow}`}>
                {t("readinessLevelLow")}
              </span>
            ) : null}
          </div>
          {readiness.probability !== null ? (
            (() => {
              const percent = Math.round(readiness.probability * 100);
              return (
                <>
                  <span className={styles.readinessValue}>
                    {t("readinessPercent", { percent })}
                  </span>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                  </div>
                  <span className={styles.readinessCaption}>
                    {readiness.attemptsUsed === 1
                      ? t("readinessBasedOnOne")
                      : t("readinessBasedOnMany", { count: readiness.attemptsUsed })}
                  </span>
                </>
              );
            })()
          ) : (
            <span className={styles.readinessCaption}>{t("readinessEmpty")}</span>
          )}
        </div>

        <Link href="/exam" className={styles.noUnderline}>
          <div className={styles.examCta}>
            <span className={styles.examCtaIcon}>
              <Icon name="timer" size={22} />
            </span>
            <div className={styles.examCtaBody}>
              <span className={styles.examCtaTitle}>{t("examCtaTitle")}</span>
              <span className={styles.examCtaDesc}>{t("examCtaDesc")}</span>
            </div>
            <Icon name="chevron-left" size={18} />
          </div>
        </Link>

        {weakTopics.length > 0 && (
          <div className={styles.topicsSection}>
            <div className={styles.topicsHeader}>
              <h2>{t("weakTopicsHeader")}</h2>
            </div>
            {weakTopics.map(({ topic, accuracy }) => {
              const percent = Math.round(accuracy * 100);
              const topicAny = topic as Record<string, unknown>;
              const topicName = (topicAny[nameField] as string) ?? topic.name_he;
              return (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className={styles.noUnderline}
                >
                  <div className={styles.topicLink}>
                    {topic.icon && (
                      <div className={styles.topicIconWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={topic.icon} alt="" className={styles.topicIconImg} />
                      </div>
                    )}
                    <div className={styles.topicBody}>
                      <div className={styles.topicTitleRow}>
                        <span className={styles.topicName}>{topicName}</span>
                        <span className={styles.weakTopicPct}>
                          {t("weakTopicAccuracy", { percent })}
                        </span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${styles.progressFillWeak}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <Icon name="chevron-left" size={18} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className={styles.topicsSection}>
          <div className={styles.topicsHeader}>
            <h2>{t("topicsHeader")}</h2>
            <span className={styles.topicsCount}>
              {completedCount} / {topics.length}
            </span>
          </div>

          {topics.map((topic) => {
            const prog = progressMap[topic.id];
            const pct = prog?.best_score ?? 0;
            const done = prog?.status === "completed";
            const topicAny = topic as Record<string, unknown>;
            const topicName = (topicAny[nameField] as string) ?? topic.name_he;
            const topicDesc = (topicAny[descField] as string) ?? topic.description_he;
            return (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className={styles.noUnderline}
              >
                <div className={styles.topicLink}>
                  {topic.icon && (
                    <div className={styles.topicIconWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={topic.icon} alt="" className={styles.topicIconImg} />
                    </div>
                  )}
                  <div className={styles.topicBody}>
                    <div className={styles.topicTitleRow}>
                      <span className={styles.topicName}>{topicName}</span>
                      <span className={`${styles.topicStatus} ${done ? styles.topicStatusDone : ""}`}>
                        {done ? t("topicCompleted") : pct > 0 ? `${pct}%` : t("topicNotStarted")}
                      </span>
                    </div>
                    {topicDesc && (
                      <span className={styles.topicDesc}>{topicDesc}</span>
                    )}
                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressFill} ${done ? styles.progressFillDone : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <TabBar active="home" />
    </>
  );
}

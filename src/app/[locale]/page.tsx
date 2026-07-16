import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getUserStats,
  getTopicProgress,
  getExamAttempts,
  getTopicAccuracy,
  getTopicQuestionCounts,
} from "@/lib/db";
import { nextMedalTarget } from "@/lib/quiz";
import { computeReadiness, findWeakestTopics, READINESS_MAX_ATTEMPTS } from "@/lib/readiness";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations, getLocale } from "next-intl/server";
import { localizedRecordField } from "@/lib/content-locale";
import styles from "./page.module.css";

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
        {done ? "✓" : i}
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
  noStore();
  const locale = await getLocale();
  const t = await getTranslations("Home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/");

  const [stats, topics, progressRows, examAttempts, topicAccuracy, questionCounts] = await Promise.all([
    getUserStats(supabase, user.id),
    getTopics(supabase),
    getTopicProgress(supabase, user.id),
    getExamAttempts(supabase, user.id, READINESS_MAX_ATTEMPTS),
    getTopicAccuracy(supabase, user.id),
    getTopicQuestionCounts(supabase),
  ]);

  const progressMap = Object.fromEntries(progressRows.map((p) => [p.topic_id, p]));
  // Distinct questions answered per topic (one response row per question).
  const answeredMap = Object.fromEntries(topicAccuracy.map((a) => [a.topic_id, a.total]));

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

  // Overall theory progress across the listed topics: sums the same maps the
  // topic cards use, so no extra queries are needed.
  const totalQuestions = topics.reduce((sum, topic) => sum + (questionCounts[topic.id] ?? 0), 0);
  const answeredQuestions = topics.reduce((sum, topic) => sum + (answeredMap[topic.id] ?? 0), 0);
  // Floor, not round: the bar must not show 100% while questions remain.
  const overallPct =
    totalQuestions > 0
      ? Math.min(100, Math.floor((answeredQuestions / totalQuestions) * 100))
      : 0;
  const remainingQuestions = Math.max(totalQuestions - answeredQuestions, 0);

  const nextMedal = nextMedalTarget(stats.streak_days);
  const daysToNextMedal = nextMedal !== null ? nextMedal - stats.streak_days : null;

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return t("greetingMorning");
    if (h < 17) return t("greetingNoon");
    return t("greetingEvening");
  }

  function getTopicName(topic: { name_he: string; name_ar?: string | null }) {
    return localizedRecordField(locale, topic as Record<string, unknown>, "name_he", "name_ar");
  }

  function getTopicDescription(topic: { description_he: string | null; description_ar?: string | null }) {
    return localizedRecordField(
      locale,
      topic as Record<string, unknown>,
      "description_he",
      "description_ar"
    );
  }

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topBar}>
          <span className={styles.wordmark}>{t("wordmark")}</span>
          <div className={styles.pillsRow}>
            <span className={`${styles.pill} ${styles.pillStreak}`}>
              <Icon name="flame" size={15} />
              <span className="sr-only">{t("streakLabel")}</span>
              <span data-stat="streak">{stats.streak_days}</span>
            </span>
            <span className={`${styles.pill} ${styles.pillPoints}`}>
              <Icon name="star" size={15} />
              <span className="sr-only">{t("pointsLabel")}</span>
              <span data-stat="points">{stats.star_points}</span>
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
                ? t("daysToMedalOne")
                : t("daysToMedalMany", { count: daysToNextMedal })}
            </span>
          ) : stats.streak_days >= 30 ? (
            <span className={styles.medalNudge}>{t("allMedals")}</span>
          ) : null}
        </div>

        {todayTopic ? (
          <div className={styles.todayCard}>
            <span className={styles.todayBadge}>{t("todayBadge")}</span>
            <div className={styles.todayTaskInfo}>
              <h2>{getTopicName(todayTopic)}</h2>
              <span className={styles.todayTaskDesc}>
                {t("todayTaskDesc", { count: questionCounts[todayTopic.id] ?? 0 })}
              </span>
            </div>
            {(() => {
              const totalQ = questionCounts[todayTopic.id] ?? 0;
              const answered = answeredMap[todayTopic.id] ?? 0;
              const pct =
                progressMap[todayTopic.id]?.status === "completed"
                  ? 100
                  : totalQ > 0
                  ? Math.round((answered / totalQ) * 100)
                  : 0;
              const current = pct >= 100 ? 6 : pct >= 67 ? 4 : pct >= 34 ? 3 : pct >= 1 ? 2 : 1;
              return <PathProgress total={5} current={current} />;
            })()}
            <Link href={`/topics/${todayTopic.slug}`} className="btn-primary">
              {t("startBtn")}
            </Link>
          </div>
        ) : (
          <div className={styles.emptyStateCard}>
            <h2>{t("emptyStateTitle")}</h2>
            <span className={styles.emptyCardDesc}>{t("emptyStateDesc")}</span>
            <Link href="/schedule" className="btn-primary">
              {t("emptyStateBtn")}
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
              const localizedTopicName = getTopicName(topic);
              return (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className={styles.noUnderline}
                >
                  <div className={styles.topicLink}>
                    {topic.icon && (
                      <div className={styles.topicIconWrap}>
                        <Image src={topic.icon} alt="" width={34} height={34} className={styles.topicIconImg} />
                      </div>
                    )}
                    <div className={styles.topicBody}>
                      <div className={styles.topicTitleRow}>
                        <span className={styles.topicName}>{localizedTopicName}</span>
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
              {t("topicsPercent", { percent: overallPct })}
            </span>
          </div>

          <div className={styles.overallProgress}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${overallPct}%` }} />
            </div>
            <div className={styles.overallMeta}>
              <span>
                {t("topicsAnsweredOverall", {
                  answered: answeredQuestions,
                  total: totalQuestions,
                })}
              </span>
              <span>
                {remainingQuestions === 0
                  ? t("topicsAllAnswered")
                  : remainingQuestions === 1
                  ? t("topicsRemainingOne")
                  : t("topicsRemaining", { count: remainingQuestions })}
              </span>
            </div>
          </div>

          {topics.map((topic) => {
            const prog = progressMap[topic.id];
            const done = prog?.status === "completed";
            const answered = answeredMap[topic.id] ?? 0;
            const totalQ = questionCounts[topic.id] ?? 0;
            const coveragePct = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;
            // Completed topics keep showing the quiz score; in-progress ones
            // show coverage so the card moves with every answered question.
            const pct = done ? prog?.best_score ?? 0 : coveragePct;
            const localizedTopicName = getTopicName(topic);
            const localizedTopicDesc = getTopicDescription(topic);
            return (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className={styles.noUnderline}
              >
                <div className={styles.topicLink}>
                  {topic.icon && (
                    <div className={styles.topicIconWrap}>
                      <Image src={topic.icon} alt="" width={34} height={34} className={styles.topicIconImg} />
                    </div>
                  )}
                  <div className={styles.topicBody}>
                    <div className={styles.topicTitleRow}>
                      <span className={styles.topicName}>{localizedTopicName}</span>
                      <span className={`${styles.topicStatus} ${done ? styles.topicStatusDone : ""}`}>
                        {done
                          ? t("topicCompleted")
                          : answered > 0
                          ? t("topicAnsweredCountPct", {
                              answered,
                              total: totalQ,
                              percent: coveragePct,
                            })
                          : t("topicNotStarted")}
                      </span>
                    </div>
                    {localizedTopicDesc && (
                      <span className={styles.topicDesc}>{localizedTopicDesc}</span>
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
      <Script src="/js/stats-pills.js" strategy="afterInteractive" />
    </>
  );
}

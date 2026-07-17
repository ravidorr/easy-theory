import type { CSSProperties } from "react";
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
  getQuestionNumbersForTopic,
  getAnsweredQuestionIdsForTopic,
  getQuizAccuracyForWindow,
} from "@/lib/db";
import { nextMedalTarget } from "@/lib/quiz";
import {
  DAILY_GOAL_QUESTIONS,
  completionSummary,
  levelForPoints,
} from "@/lib/gamification";
import {
  computeReadiness,
  findStrongestTopics,
  findWeakestTopics,
  READINESS_MAX_ATTEMPTS,
} from "@/lib/readiness";
import {
  buildGreetingContext,
  dayWindow,
  findResumePoint,
  pickLastStudiedInProgressTopic,
  selectFocusTopic,
} from "@/lib/personalization";
import { buildTopicCardMeta, type TopicDifficulty, type TopicDuration } from "@/lib/topic-card";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations, getLocale } from "next-intl/server";
import { localizedRecordField } from "@/lib/content-locale";
import styles from "./page.module.css";

const DIFFICULTY_CHIP: Record<TopicDifficulty, { labelKey: string; className: string }> = {
  easy: { labelKey: "topicDifficultyEasy", className: "topicChipEasy" },
  medium: { labelKey: "topicDifficultyMedium", className: "topicChipMedium" },
  hard: { labelKey: "topicDifficultyHard", className: "topicChipHard" },
};

const MISSION_RING_RADIUS = 30;
const MISSION_RING_CIRC = 2 * Math.PI * MISSION_RING_RADIUS;

// Past this coverage the mock exam is the next meaningful step, so the exam
// card jumps above the daily mission instead of hiding below the fold. Kept
// in sync by value with REMAINING_LINE_MIN_PERCENT (personalization.ts) but
// tunable on its own: one gates greeting copy, this one gates card order.
const EXAM_CARD_EARLY_MIN_PERCENT = 50;

function MissionRing({
  pct,
  complete,
  label,
  percentText,
}: {
  pct: number;
  complete: boolean;
  label: string;
  percentText: string;
}) {
  return (
    <div
      className={styles.missionRing}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      data-empty={pct === 0 || undefined}
      style={
        {
          "--ring-circ": `${MISSION_RING_CIRC}px`,
          "--ring-offset": `${MISSION_RING_CIRC * (1 - pct / 100)}px`,
        } as CSSProperties
      }
    >
      <svg className={styles.missionRingSvg} viewBox="0 0 72 72" aria-hidden="true" focusable="false">
        <circle className={styles.missionRingTrack} cx="36" cy="36" r={MISSION_RING_RADIUS} />
        <circle className={styles.missionRingFill} cx="36" cy="36" r={MISSION_RING_RADIUS} />
      </svg>
      <span className={styles.missionRingValue} aria-hidden="true">
        {complete ? "✓" : percentText}
      </span>
    </div>
  );
}

type HomeTranslator = Awaited<ReturnType<typeof getTranslations<"Home">>>;

function DurationChip({ t, duration }: { t: HomeTranslator; duration: TopicDuration }) {
  return (
    <span className={styles.topicChip}>
      <Icon name="timer" size={12} />
      {duration.unit === "hours"
        ? t("topicDurationHours", { hours: duration.value })
        : t("topicDurationMinutes", { minutes: duration.value })}
    </span>
  );
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

  // Personalized greeting inputs: yesterday's accuracy uses the Asia/Jerusalem
  // day, like the streak logic. It only depends on the user, so it joins the
  // main fetch round.
  const now = new Date();
  const yesterdayWindow = dayWindow(now, 1);
  const todayWindow = dayWindow(now, 0);

  const [
    stats,
    topics,
    progressRows,
    examAttempts,
    topicAccuracy,
    questionCounts,
    yesterdayAccuracy,
    todayAccuracy,
  ] = await Promise.all([
    getUserStats(supabase, user.id),
    getTopics(supabase),
    getTopicProgress(supabase, user.id),
    getExamAttempts(supabase, user.id, READINESS_MAX_ATTEMPTS),
    getTopicAccuracy(supabase, user.id),
    getTopicQuestionCounts(supabase),
    getQuizAccuracyForWindow(
      supabase,
      user.id,
      yesterdayWindow.fromIso,
      yesterdayWindow.toIso
    ),
    getQuizAccuracyForWindow(
      supabase,
      user.id,
      todayWindow.fromIso,
      todayWindow.toIso
    ),
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
  const missionMeta = todayTopic
    ? buildTopicCardMeta({
        slug: todayTopic.slug,
        totalQuestions: questionCounts[todayTopic.id] ?? 0,
        answeredQuestions: answeredMap[todayTopic.id] ?? 0,
        progress: progressMap[todayTopic.id],
      })
    : null;
  const missionPct = missionMeta ? (missionMeta.done ? 100 : missionMeta.coveragePct) : 0;
  const missionComplete = missionPct >= 100;

  // Resume point in the last-studied topic. Only this fetch depends on the
  // main round; it is skipped entirely when nothing is in progress. The
  // greeting lines are all optional; new users get none.
  const lastStudied = pickLastStudiedInProgressTopic(progressRows);
  let resumePoint = null;
  if (lastStudied) {
    const [topicQuestions, answeredIds] = await Promise.all([
      getQuestionNumbersForTopic(supabase, lastStudied.topic_id),
      getAnsweredQuestionIdsForTopic(supabase, user.id, lastStudied.topic_id),
    ]);
    resumePoint = findResumePoint(topicQuestions, answeredIds);
  }

  // Overall theory progress across the listed topics: sums the same maps the
  // topic cards use, so no extra queries are needed.
  const completion = completionSummary(
    topics.map((topic) => topic.id),
    questionCounts,
    answeredMap
  );
  const surfaceExamCardEarly = completion.percent >= EXAM_CARD_EARLY_MIN_PERCENT;

  const focusTopic = selectFocusTopic(weakTopics, lastStudied?.topic_id ?? null);
  const masteredTopic = findStrongestTopics(topicAccuracy)[0] ?? null;
  const personalLines = buildGreetingContext({
    resume:
      resumePoint && lastStudied
        ? { ...resumePoint, topicId: lastStudied.topic_id }
        : null,
    yesterday: yesterdayAccuracy,
    focusTopicId: focusTopic?.topic_id ?? null,
    masteredTopicId: masteredTopic?.topic_id ?? null,
    remaining: {
      count: completion.remainingQuestions,
      percent: completion.percent,
    },
    readinessLevel: readiness.level,
    examCardSurfaced: surfaceExamCardEarly,
    now,
  });

  const nextMedal = nextMedalTarget(stats.streak_days);
  const daysToNextMedal = nextMedal !== null ? nextMedal - stats.streak_days : null;

  const levelInfo = levelForPoints(stats.star_points);
  const levelPct = Math.round(levelInfo.progress * 100);
  const answeredToday = todayAccuracy.total;
  const dailyGoalDone = answeredToday >= DAILY_GOAL_QUESTIONS;
  const dailyGoalPct = Math.min(
    100,
    Math.round((answeredToday / DAILY_GOAL_QUESTIONS) * 100)
  );
  const dailyGoalRemaining = Math.max(DAILY_GOAL_QUESTIONS - answeredToday, 0);

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return t("greetingMorning");
    if (h < 17) return t("greetingNoon");
    return t("greetingEvening");
  }

  function medalNudgeText() {
    if (nextMedal === null || daysToNextMedal === null) return null;
    if (stats.streak_days === 0)
      return t("daysToMedalStart", { count: daysToNextMedal });
    const medal = t(`medalName${nextMedal}`);
    if (daysToNextMedal === 1) return t("daysToMedalOne", { medal });
    return t("daysToMedalMany", { count: daysToNextMedal, medal });
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

  const examCta = (
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
  );

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topBar}>
          <span className={styles.wordmark}>{t("wordmark")}</span>
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
            <span className={styles.medalNudge}>{medalNudgeText()}</span>
          ) : stats.streak_days >= 30 ? (
            <span className={styles.medalNudge}>{t("allMedals")}</span>
          ) : null}
          {personalLines.length > 0 && (
            <div className={styles.personalLines}>
              {personalLines.map((line) => {
                if (line.kind === "yesterday") {
                  return (
                    <span key={line.kind} className={styles.personalLine}>
                      {line.good
                        ? t("yesterdayAccuracyHigh", { percent: line.percent })
                        : t("yesterdayAccuracyLow", { percent: line.percent })}
                    </span>
                  );
                }
                if (line.kind === "examReady") {
                  return (
                    <Link
                      key={line.kind}
                      href="/exam"
                      className={styles.personalLineLink}
                    >
                      {t("examReadyLine")}
                    </Link>
                  );
                }
                if (line.kind === "remaining") {
                  return (
                    <span key={line.kind} className={styles.personalLine}>
                      {line.count === 1
                        ? t("remainingQuestionsLineOne")
                        : t("remainingQuestionsLine", { count: line.count })}
                    </span>
                  );
                }
                const topic = topicsById.get(line.topicId);
                if (!topic) return null;
                if (line.kind === "resume") {
                  return (
                    <Link
                      key={line.kind}
                      href={`/topics/${topic.slug}`}
                      className={styles.personalLineLink}
                    >
                      {line.minutes === 1
                        ? t("resumeLineOneMinute", { number: line.questionNumber })
                        : t("resumeLine", {
                            number: line.questionNumber,
                            minutes: line.minutes,
                          })}
                    </Link>
                  );
                }
                if (line.kind === "mastered") {
                  return (
                    <span key={line.kind} className={styles.personalLine}>
                      {t("masteredTopicLine", { topic: getTopicName(topic) })}
                    </span>
                  );
                }
                if (line.kind === "focus") {
                  return (
                    <span key={line.kind} className={styles.personalLine}>
                      {t("focusTopicLine", { topic: getTopicName(topic) })}
                    </span>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>

        <section className={styles.statsStrip} aria-label={t("statsStripLabel")}>
          <div className={styles.statTile}>
            <span className={`${styles.statTileIcon} ${styles.statTileIconStreak}`}>
              <Icon name="flame" size={18} />
            </span>
            <span className={styles.statTileValue} data-stat="streak">
              {stats.streak_days}
            </span>
            <span className={styles.statTileLabel}>{t("statsStreakLabel")}</span>
          </div>
          <div className={styles.statTile}>
            <span className={`${styles.statTileIcon} ${styles.statTileIconPoints}`}>
              <Icon name="star" size={18} />
            </span>
            <span className={styles.statTileValue} data-stat="points">
              {stats.star_points}
            </span>
            <span className={styles.statTileLabel}>{t("statsPointsLabel")}</span>
          </div>
          <div className={styles.statTile}>
            <span className={`${styles.statTileIcon} ${styles.statTileIconLevel}`}>
              <Icon name="gem" size={18} />
            </span>
            <span className={styles.statTileValue}>{levelInfo.level}</span>
            <span className={styles.statTileLabel}>{t("statsLevelLabel")}</span>
            <div className={`${styles.progressTrack} ${styles.statTileTrack}`}>
              <div className={styles.progressFill} style={{ width: `${levelPct}%` }} />
            </div>
            <span className={styles.statTileCaption}>
              {t("levelToNext", {
                points: levelInfo.pointsForNextLevel - levelInfo.pointsIntoLevel,
              })}
            </span>
          </div>
          <div className={styles.statTile}>
            <span
              className={`${styles.statTileIcon} ${
                dailyGoalDone ? styles.statTileIconGoalDone : styles.statTileIconGoal
              }`}
            >
              <Icon name={dailyGoalDone ? "check" : "timer"} size={18} />
            </span>
            <span className={styles.statTileValue}>
              {t("dailyGoalValue", {
                answered: answeredToday,
                goal: DAILY_GOAL_QUESTIONS,
              })}
            </span>
            <span className={styles.statTileLabel}>{t("dailyGoalLabel")}</span>
            <div className={`${styles.progressTrack} ${styles.statTileTrack}`}>
              <div
                className={`${styles.progressFill} ${
                  dailyGoalDone ? styles.progressFillDone : ""
                }`}
                style={{ width: `${dailyGoalPct}%` }}
              />
            </div>
            <span
              className={`${styles.statTileCaption} ${
                dailyGoalDone ? styles.statTileCaptionDone : ""
              }`}
            >
              {dailyGoalDone
                ? t("dailyGoalDone")
                : dailyGoalRemaining === 1
                ? t("dailyGoalRemainingOne")
                : t("dailyGoalRemaining", { count: dailyGoalRemaining })}
            </span>
          </div>
        </section>

        {surfaceExamCardEarly && examCta}

        {todayTopic && missionMeta ? (
          <div className={styles.todayCard} data-complete={missionComplete || undefined}>
            <span className={styles.todayBadge}>{t("todayBadge")}</span>
            <div className={styles.missionRow}>
              <MissionRing
                pct={missionPct}
                complete={missionComplete}
                label={t("missionProgressLabel")}
                percentText={t("topicsPercent", { percent: missionPct })}
              />
              <div className={styles.todayTaskInfo}>
                <h2>{getTopicName(todayTopic)}</h2>
                <span className={styles.todayTaskDesc}>
                  {t("todayTaskDesc", { count: missionMeta.total })}
                </span>
                {missionComplete || missionMeta.duration ? (
                  <div className={styles.topicMetaRow}>
                    {missionComplete ? (
                      <span className={styles.missionCompleteLabel}>
                        {t("missionCompleteLabel")}
                      </span>
                    ) : (
                      <>
                        {missionMeta.duration ? (
                          <DurationChip t={t} duration={missionMeta.duration} />
                        ) : null}
                        {missionMeta.remainingPoints > 0 ? (
                          <span className={`${styles.topicChip} ${styles.missionXpChip}`}>
                            <Icon name="star" size={12} />
                            {t("missionXpReward", { points: missionMeta.remainingPoints })}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
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

        {!surfaceExamCardEarly && examCta}

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
              {t("topicsPercent", { percent: completion.percent })}
            </span>
          </div>

          <div className={styles.overallProgress}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${completion.percent}%` }} />
            </div>
            <div className={styles.overallMeta}>
              <span>
                {t("topicsAnsweredOverall", {
                  answered: completion.answeredQuestions,
                  total: completion.totalQuestions,
                })}
              </span>
              <span>
                {completion.remainingQuestions === 0
                  ? t("topicsAllAnswered")
                  : completion.remainingQuestions === 1
                  ? t("topicsRemainingOne")
                  : t("topicsRemaining", { count: completion.remainingQuestions })}
              </span>
            </div>
          </div>

          {topics.map((topic) => {
            const meta = buildTopicCardMeta({
              slug: topic.slug,
              totalQuestions: questionCounts[topic.id] ?? 0,
              answeredQuestions: answeredMap[topic.id] ?? 0,
              progress: progressMap[topic.id],
            });
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
                      <span className={`${styles.topicStatus} ${meta.done ? styles.topicStatusDone : ""}`}>
                        {meta.done
                          ? meta.bestScore != null
                            ? t("topicCompletedScore", { percent: meta.bestScore })
                            : t("topicCompleted")
                          : meta.answered > 0
                          ? t("topicAnsweredCountPct", {
                              answered: meta.answered,
                              total: meta.total,
                              percent: meta.coveragePct,
                            })
                          : t("topicNotStarted")}
                      </span>
                    </div>
                    {localizedTopicDesc && (
                      <span className={styles.topicDesc}>{localizedTopicDesc}</span>
                    )}
                    {(meta.difficulty || meta.remainingPoints > 0) && (
                      <div className={styles.topicMetaRow}>
                        {meta.difficulty && (
                          <span
                            className={`${styles.topicChip} ${styles[DIFFICULTY_CHIP[meta.difficulty].className]}`}
                          >
                            {t(DIFFICULTY_CHIP[meta.difficulty].labelKey)}
                          </span>
                        )}
                        {meta.duration && <DurationChip t={t} duration={meta.duration} />}
                        {meta.remainingPoints > 0 && (
                          <span className={styles.topicChip}>
                            <Icon name="star" size={12} />
                            {t("topicPointsRemaining", { points: meta.remainingPoints })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressFill} ${meta.done ? styles.progressFillDone : ""}`}
                        style={{ width: `${meta.barPct}%` }}
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

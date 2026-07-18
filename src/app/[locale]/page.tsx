import type { CSSProperties } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getTopicProgress,
  getExamAttempts,
  getTopicAccuracy,
  getTopicQuestionCounts,
  getQuizAnswerEventCountForWindow,
} from "@/lib/db";
import { DAILY_GOAL_QUESTIONS } from "@/lib/gamification";
import { computeReadiness, findWeakestTopics, READINESS_MAX_ATTEMPTS } from "@/lib/readiness";
import { dayWindow, selectNextTopic } from "@/lib/personalization";
import { buildTopicCardMeta } from "@/lib/topic-card";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations, getLocale } from "next-intl/server";
import { localizedRecordField } from "@/lib/content-locale";
import styles from "./page.module.css";

const MISSION_RING_RADIUS = 30;
const MISSION_RING_CIRC = 2 * Math.PI * MISSION_RING_RADIUS;

function MissionRing({
  pct,
  label,
  percentText,
}: {
  pct: number;
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
      <span className={styles.missionRingValue}>{percentText}</span>
    </div>
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

  const todayWindow = dayWindow(new Date(), 0);
  const [topics, progressRows, examAttempts, topicAccuracy, questionCounts, answeredToday] =
    await Promise.all([
      getTopics(supabase),
      getTopicProgress(supabase, user.id),
      getExamAttempts(supabase, user.id, READINESS_MAX_ATTEMPTS),
      getTopicAccuracy(supabase, user.id),
      getTopicQuestionCounts(supabase),
      getQuizAnswerEventCountForWindow(
        supabase,
        user.id,
        todayWindow.fromIso,
        todayWindow.toIso
      ),
    ]);

  const progressMap = Object.fromEntries(progressRows.map((progress) => [progress.topic_id, progress]));
  const answeredMap = Object.fromEntries(topicAccuracy.map((accuracy) => [accuracy.topic_id, accuracy.total]));
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const weakTopics = findWeakestTopics(topicAccuracy, topics.length).flatMap((weak) => {
    const topic = topicsById.get(weak.topic_id);
    return topic ? [{ ...weak, topic }] : [];
  });
  const weakTopicIds = new Set(weakTopics.map((weak) => weak.topic_id));
  const readiness = computeReadiness(examAttempts);

  const hasUnansweredQuestions = (topic: { id: string }) =>
    (answeredMap[topic.id] ?? 0) < (questionCounts[topic.id] ?? 0);
  const todayTopic = selectNextTopic(topics, progressMap, null, hasUnansweredQuestions);
  const reviewTopic = todayTopic
    ? null
    : weakTopics.find(({ topic }) => !hasUnansweredQuestions(topic))?.topic ?? null;
  const missionTopic = todayTopic ?? reviewTopic;
  const missionIsReview = reviewTopic !== null;
  const missionMeta = missionTopic
    ? buildTopicCardMeta({
        totalQuestions: questionCounts[missionTopic.id] ?? 0,
        answeredQuestions: answeredMap[missionTopic.id] ?? 0,
        progress: progressMap[missionTopic.id],
      })
    : null;
  const missionPct = missionMeta ? (missionMeta.done ? 100 : missionMeta.coveragePct) : 0;
  const dailyProgress = Math.min(answeredToday, DAILY_GOAL_QUESTIONS);

  function getTopicName(topic: { name_he: string; name_ar?: string | null }) {
    return localizedRecordField(locale, topic as Record<string, unknown>, "name_he", "name_ar");
  }

  const readinessText =
    readiness.probability === null
      ? t("readinessEmpty")
      : t("examReadiness", {
          percent: Math.round(readiness.probability * 100),
          level: t(`readinessLevel${readiness.level[0].toUpperCase()}${readiness.level.slice(1)}`),
        });

  return (
    <>
      <main className={styles.page}>
        <h1>{t("todayBadge")}</h1>

        {missionTopic && missionMeta ? (
          <section className={styles.todayCard}>
            <div className={styles.missionRow}>
              <MissionRing
                pct={missionPct}
                label={t("missionProgressLabel")}
                percentText={t("topicsPercent", { percent: missionPct })}
              />
              <div className={styles.todayTaskInfo}>
                <h2>{getTopicName(missionTopic)}</h2>
                <span className={styles.todayTaskDesc}>
                  {missionIsReview
                    ? t("todayReviewTaskDesc")
                    : t("todayTaskDesc", { count: missionMeta.total })}
                </span>
                <span className={styles.dailyProgress}>
                  {t("dailyProgress", {
                    answered: dailyProgress,
                    goal: DAILY_GOAL_QUESTIONS,
                  })}
                </span>
              </div>
            </div>
            <Link
              href={`/topics/${missionTopic.slug}${missionIsReview ? "/review" : ""}`}
              className="btn-primary"
            >
              {missionIsReview ? t("missionReviewBtn") : t("startBtn")}
            </Link>
          </section>
        ) : (
          <section className={styles.emptyStateCard}>
            <h2>{t("emptyStateTitle")}</h2>
            <span className={styles.emptyCardDesc}>{t("emptyStateDesc")}</span>
            <Link href="/schedule" className="btn-primary">
              {t("emptyStateBtn")}
            </Link>
          </section>
        )}

        <Link href="/exam" className={styles.noUnderline}>
          <section className={`pressable-card ${styles.examCta}`}>
            <span className={styles.examCtaIcon}>
              <Icon name="timer" size={22} />
            </span>
            <div className={styles.examCtaBody}>
              <span className={styles.examCtaTitle}>{t("examCtaTitle")}</span>
              <span className={styles.examCtaDesc}>{t("examCtaDesc")}</span>
              <span className={styles.examReadiness}>{readinessText}</span>
            </div>
            <Icon name="chevron-left" size={18} />
          </section>
        </Link>

        <section className={styles.topicsSection}>
          <h2>{t("topicsHeader")}</h2>
          {topics.map((topic) => {
            const meta = buildTopicCardMeta({
              totalQuestions: questionCounts[topic.id] ?? 0,
              answeredQuestions: answeredMap[topic.id] ?? 0,
              progress: progressMap[topic.id],
            });
            const needsPractice = !meta.done && weakTopicIds.has(topic.id);
            const status = meta.done
              ? t("topicCompleted")
              : needsPractice
              ? t("topicNeedsPractice")
              : meta.answered > 0
              ? t("topicInProgress")
              : t("topicNotStarted");

            return (
              <Link key={topic.id} href={`/topics/${topic.slug}`} className={styles.noUnderline}>
                <div className={`pressable-card ${styles.topicLink}`} data-complete={meta.done || undefined}>
                  {topic.icon && (
                    <div className={styles.topicIconWrap}>
                      <Image src={topic.icon} alt="" width={34} height={34} className={styles.topicIconImg} />
                    </div>
                  )}
                  <div className={styles.topicBody}>
                    <div className={styles.topicTitleRow}>
                      <span className={styles.topicName}>{getTopicName(topic)}</span>
                      <span
                        className={`${styles.topicStatus} ${
                          needsPractice ? styles.topicStatusNeedsPractice : ""
                        }`}
                      >
                        {meta.done && <Icon name="check" size={12} />}
                        {status}
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${meta.barPct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
      <TabBar active="home" />
    </>
  );
}

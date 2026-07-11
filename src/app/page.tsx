import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getUserStats,
  getTopicProgress,
} from "@/lib/db";
import { nextMedalTarget } from "@/lib/quiz";
import { TabBar } from "@/components/TabBar";
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
  return (
    <div className={styles.pathProgress}>{items}</div>
  );
}

const FlameIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.5c.4 2.2 3.1 3.4 3.9 5.8.9 2.7-.8 6-3.9 6s-4.8-3.3-3.9-6c.4-1.3 1.4-2.2 2.2-3.2.8-1 1.5-1.7 1.7-2.6z" />
    <circle cx="8" cy="10.6" r="2.1" fill="var(--surface)" opacity="0.85" />
  </svg>
);

const StarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z" />
  </svg>
);

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/");

  const [stats, topics, progressRows] = await Promise.all([
    getUserStats(supabase, user.id),
    getTopics(supabase),
    getTopicProgress(supabase, user.id),
  ]);

  const progressMap = Object.fromEntries(
    progressRows.map((p) => [p.topic_id, p])
  );

  const todayTopic =
    topics.find((t) => progressMap[t.id]?.status === "in_progress") ??
    topics.find((t) => !progressMap[t.id] || progressMap[t.id].status === "not_started") ??
    null;

  const completedCount = progressRows.filter((p) => p.status === "completed").length;

  const MEDAL_EMOJI: Record<number, string> = { 3: "🔥", 7: "⭐", 14: "💎", 30: "🏆" };
  const nextMedal = nextMedalTarget(stats.streak_days);
  const daysToNextMedal = nextMedal !== null ? nextMedal - stats.streak_days : null;

  return (
    <>
    <main className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.wordmark}>דרך ברורה</span>
        <div className={styles.pillsRow}>
          <span className={`${styles.pill} ${styles.pillStreak}`}>
            <FlameIcon />
            {stats.streak_days}
          </span>
          <span className={`${styles.pill} ${styles.pillPoints}`}>
            <StarIcon />
            {stats.star_points}
          </span>
        </div>
      </div>

      {/* Greeting */}
      <div className={styles.greeting}>
        <h1>{timeGreeting()}!</h1>
        <span className={styles.greetingText}>
          {stats.streak_days === 0
            ? "יאללה, לעבודה!"
            : stats.streak_days === 1
            ? "יום ראשון ברצף, קצב טוב."
            : `${stats.streak_days} ימים ברצף, קצב טוב.`}
        </span>
        {daysToNextMedal !== null ? (
          <span className={styles.medalNudge}>
            עוד {daysToNextMedal} {daysToNextMedal === 1 ? "יום" : "ימים"} לאות הבא {MEDAL_EMOJI[nextMedal!]}
          </span>
        ) : stats.streak_days >= 30 ? (
          <span className={styles.medalNudge}>השגת את כל האותות! 🏆</span>
        ) : null}
      </div>

      {/* Today's task card */}
      {todayTopic ? (
        <div className={styles.todayCard}>
          <span className={styles.todayBadge}>המשימה להיום</span>
          <div className={styles.todayTaskInfo}>
            <h2>{todayTopic.name_he}</h2>
            <span className={styles.todayTaskDesc}>8 שאלות תרגול · ~20 דק׳</span>
          </div>
          {/* Step path */}
          {(() => {
            const pct = progressMap[todayTopic.id]?.best_score ?? 0;
            const current = pct >= 100 ? 6 : pct >= 67 ? 4 : pct >= 34 ? 3 : pct >= 1 ? 2 : 1;
            return <PathProgress total={5} current={current} />;
          })()}
          <Link href={`/topics/${todayTopic.slug}`} className={styles.noUnderline}>
            <button className="btn-primary">יאללה, לעבודה!</button>
          </Link>
        </div>
      ) : (
        <div className={styles.emptyStateCard}>
          <h2>מתי נוח לך ללמוד?</h2>
          <span className={styles.emptyCardDesc}>קבעי תוכנית שבועית ונתחיל.</span>
          <Link href="/schedule" className={styles.noUnderline}>
            <button className="btn-primary">קבעי תוכנית</button>
          </Link>
        </div>
      )}

      {/* Topics */}
      <div className={styles.topicsSection}>
        <div className={styles.topicsHeader}>
          <h2>הנושאים שלך</h2>
          <span className={styles.topicsCount}>
            {completedCount} מתוך {topics.length}
          </span>
        </div>

        {topics.map((topic) => {
          const prog = progressMap[topic.id];
          const pct = prog?.best_score ?? 0;
          const done = prog?.status === "completed";
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
                    <img
                      src={topic.icon}
                      alt=""
                      className={styles.topicIconImg}
                    />
                  </div>
                )}
                <div className={styles.topicBody}>
                  <div className={styles.topicTitleRow}>
                    <span className={styles.topicName}>{topic.name_he}</span>
                    <span className={`${styles.topicStatus} ${done ? styles.topicStatusDone : ""}`}>
                      {done ? "✓ הושלם" : pct > 0 ? `${pct}%` : "טרם התחלת"}
                    </span>
                  </div>
                  {topic.description_he && (
                    <span className={styles.topicDesc}>{topic.description_he}</span>
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

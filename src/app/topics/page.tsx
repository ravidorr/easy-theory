import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getTopics, getTopicProgress } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import styles from "./page.module.css";

export default async function TopicsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [topics, progressRows] = await Promise.all([
    getTopics(supabase),
    getTopicProgress(supabase, user.id),
  ]);

  const progressMap = Object.fromEntries(
    progressRows.map((p) => [p.topic_id, p])
  );

  return (
    <>
    <main className={styles.page}>
      <h1>הנושאים</h1>

      {/* Topic cards */}
      {topics.map((topic) => {
        const prog = progressMap[topic.id];
        const pct = prog?.best_score ?? 0;
        const done = prog?.status === "completed";
        const started = prog?.status === "in_progress";

        return (
          <Link
            key={topic.id}
            href={`/topics/${topic.slug}`}
            className={styles.noUnderline}
          >
            <div className={styles.topicCard}>
              <div className={styles.topicHeader}>
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
                    {done && (
                      <span className={styles.topicDoneBadge}>✓ הושלם</span>
                    )}
                  </div>
                  {topic.description_he && (
                    <span className={styles.topicDesc}>{topic.description_he}</span>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className={styles.progressSection}>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${done ? styles.progressFillDone : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={styles.progressLabel}>
                  {done
                    ? "הנושא הושלם"
                    : started
                      ? `${pct}% הושלם`
                      : "טרם התחלת"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </main>
    <TabBar active="topics" />
    </>
  );
}

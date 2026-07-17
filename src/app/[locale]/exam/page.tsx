import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getExamAttempts } from "@/lib/db";
import {
  EXAM_QUESTION_COUNT,
  EXAM_DURATION_SECONDS,
  EXAM_PASS_MARK,
} from "@/lib/exam";
import { getTranslations, getLocale } from "next-intl/server";
import { Icon } from "@/components/Icon";
import styles from "./page.module.css";

export default async function ExamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/exam");

  const locale = await getLocale();
  const t = await getTranslations("Exam");

  const attempts = await getExamAttempts(supabase, user.id);
  const bestAttempt = attempts.reduce(
    (best, a) => (best == null || a.score > best.score ? a : best),
    null as (typeof attempts)[number] | null
  );

  const dateLocale = locale === "ar" ? "ar-IL" : "he-IL";
  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/" className={`icon-btn ${styles.closeBtn}`} aria-label={t("closeLabel")}>
          <Icon name="close" size={16} />
        </Link>
      </div>

      <h1>{t("pageTitle")}</h1>
      <p className={styles.subtitle}>{t("subtitle")}</p>

      <div className={styles.rulesCard}>
        <h2>{t("rulesTitle")}</h2>
        <ul className={styles.rulesList}>
          <li>{t("ruleQuestions", { count: EXAM_QUESTION_COUNT })}</li>
          <li>{t("ruleTime", { minutes: EXAM_DURATION_SECONDS / 60 })}</li>
          <li>{t("rulePass", { passMark: EXAM_PASS_MARK })}</li>
        </ul>
      </div>

      <Link href="/exam/run" className="btn-primary">
        {t("startBtn")}
      </Link>

      <div className={styles.historyCard}>
        <h2>{t("historyTitle")}</h2>
        {attempts.length === 0 ? (
          <p className={styles.historyEmpty}>{t("historyEmpty")}</p>
        ) : (
          <>
            {bestAttempt && (
              <p className={styles.bestScore}>
                {t("bestScore", { score: bestAttempt.score, total: bestAttempt.total })}
              </p>
            )}
            <ul className={styles.attemptList}>
              {attempts.map((attempt) => (
                <li key={attempt.id} className={styles.attemptRow}>
                  <span className={styles.attemptDate}>{fmtDate(attempt.created_at)}</span>
                  <span className={styles.attemptScore}>
                    {t("attemptScore", { score: attempt.score, total: attempt.total })}
                  </span>
                  <span
                    className={`${styles.attemptChip} ${
                      attempt.passed ? styles.attemptChipPass : styles.attemptChipFail
                    }`}
                  >
                    {attempt.passed ? t("passChip") : t("failChip")}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

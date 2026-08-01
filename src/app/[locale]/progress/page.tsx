import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getExamAttempts, getTopicAccuracy, getUserStats } from "@/lib/db";
import { computeReadiness } from "@/lib/readiness";
import { readinessConfidence } from "@/lib/learner-plan";
import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";

export default async function ProgressPage() {
  const supabase = await createClient();
  const user = await requireAuthenticatedUser(supabase, "/auth/login?next=/progress");
  const [stats, attempts, accuracy, t] = await Promise.all([
    getUserStats(supabase, user.id),
    getExamAttempts(supabase, user.id),
    getTopicAccuracy(supabase, user.id),
    getTranslations("Progress"),
  ]);
  const readiness = computeReadiness(attempts);
  const answered = accuracy.reduce((sum, row) => sum + row.total, 0);
  const confidence = readinessConfidence(readiness.attemptsUsed, answered);
  const readinessText = readiness.probability === null
    ? t("empty")
    : t(
        `readiness${readiness.level[0].toUpperCase()}${readiness.level.slice(1)}${confidence[0].toUpperCase()}${confidence.slice(1)}`
      );
  const isReadyForSimulation = readiness.level === "high" && confidence === "high";
  const nextStep = isReadyForSimulation
    ? { href: "/exam/run", label: t("simulationCta") }
    : { href: "/practice", label: t("practiceCta") };

  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>{t("title")}</h1>
        </header>

        <section className={styles.readinessCard} aria-labelledby="progress-readiness">
          <span className={styles.readinessIcon}>
            <Icon name="trophy" size={24} />
          </span>
          <div className={styles.readinessContent}>
            <h2 id="progress-readiness">{t("readinessTitle")}</h2>
            <p>{readinessText}</p>
          </div>
        </section>

        <Link href={nextStep.href} className="btn-primary">
          {nextStep.label}
        </Link>

        <dl className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={`${styles.statIcon} ${styles.statIconStreak}`}>
              <Icon name="flame" size={22} />
            </span>
            <dt>{t("streak")}</dt>
            <dd>{stats.streak_days}</dd>
          </div>
          <div className={styles.statTile}>
            <span className={`${styles.statIcon} ${styles.statIconAnswered}`}>
              <Icon name="cards" size={22} />
            </span>
            <dt>{t("answered")}</dt>
            <dd>{answered}</dd>
          </div>
          <div className={`${styles.statTile} ${styles.statTileWide}`}>
            <span className={`${styles.statIcon} ${styles.statIconSimulations}`}>
              <Icon name="timer" size={22} />
            </span>
            <dt>{t("simulations")}</dt>
            <dd>{attempts.length}</dd>
          </div>
        </dl>
      </main>
      <TabBar active="progress" />
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import { getUserSchedule } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";

const DURATIONS = [30, 45, 60];

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/schedule");

  const t = await getTranslations("Schedule");

  const schedule = await getUserSchedule(supabase, user.id);
  const scheduledDays = new Set(schedule.map((s) => s.day_of_week));
  const duration = schedule[0]?.duration_minutes ?? 45;
  const startTime = schedule[0]?.start_time ?? "17:00";
  const notify = schedule[0]?.notify ?? true;

  const DAYS = t("days").split(",");

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topBar}>
          <Link href="/more" className={`icon-btn ${styles.backBtn}`} aria-label={t("backLabel")}>
            →
          </Link>
          <div className={styles.titleCol}>
            <h1>{t("pageTitle")}</h1>
            <span className={styles.subtitle}>{t("subtitle")}</span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>{t("daysLabel")}</span>
          <div id="day-picker" className={styles.dayRow}>
            {DAYS.map((label, i) => {
              const selected = scheduledDays.has(i);
              return (
                <button
                  key={i}
                  className={`day-btn pressable ${styles.btnDay}`}
                  data-day={i}
                  data-selected={selected ? "true" : "false"}
                  aria-pressed={selected}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span id="days-label" className={styles.daysLabel}>
            {scheduledDays.size > 0
              ? t("daysSelected", { count: scheduledDays.size })
              : t("daysNone")}
          </span>
        </div>

        <div className={styles.timeCard}>
          <label className={styles.timeLabel}>
            <span className={styles.cardLabel}>{t("timeLabel")}</span>
            <input
              type="time"
              id="time-input"
              defaultValue={startTime.slice(0, 5)}
              className={styles.timeInput}
            />
          </label>

          <div className={styles.durationWrapper}>
            <span className={styles.cardLabel}>{t("durationLabel")}</span>
            <div id="duration-picker" className={styles.durationRow}>
              {DURATIONS.map((d) => {
                const active = d === duration;
                return (
                  <button
                    key={d}
                    className={`duration-btn pressable ${styles.btnDuration}`}
                    data-duration={d}
                    data-selected={active ? "true" : "false"}
                    aria-pressed={active}
                  >
                    {d} {t("durationUnit")}
                  </button>
                );
              })}
            </div>
          </div>

          <label className={styles.notifyLabel}>
            <span
              id="notify-toggle"
              role="switch"
              aria-checked={notify ? "true" : "false"}
              data-on={notify ? "true" : "false"}
              className={`pressable ${styles.toggle} ${notify ? styles.toggleOn : ""}`}
            >
              <span className={`${styles.toggleThumb} ${notify ? styles.toggleThumbOn : ""}`} />
            </span>
            <span className={styles.notifyText}>{t("notifyLabel")}</span>
          </label>
        </div>

        <div className={styles.saveArea}>
          <div id="schedule-summary" className={styles.summaryCard}>
            <span id="summary-text" className={styles.summaryText}>
              {scheduledDays.size > 0
                ? t("summarySessions", { count: scheduledDays.size, duration })
                : t("summaryChoose")}
            </span>
            <span className={styles.summaryHint}>{t("summaryHint")}</span>
          </div>
          <button id="save-schedule-btn" className="btn-primary">
            {t("saveBtn")}
          </button>
        </div>
      </main>

      <Script src="/js/modal.js" strategy="afterInteractive" />
      <Script src="/js/push.js" strategy="afterInteractive" />
      <Script src="/js/schedule.js" strategy="afterInteractive" />
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import { getUserSchedule } from "@/lib/db";
import styles from "./page.module.css";

const DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const DURATIONS = [30, 45, 60];

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const schedule = await getUserSchedule(supabase, user.id);
  const scheduledDays = new Set(schedule.map((s) => s.day_of_week));
  const duration = schedule[0]?.duration_minutes ?? 45;
  const startTime = schedule[0]?.start_time ?? "17:00";
  const notify = schedule[0]?.notify ?? true;

  return (
    <>
      <main className={styles.page}>
        {/* Header */}
        <div className={styles.topBar}>
          <Link href="/more" className={styles.backBtn}>
            →
          </Link>
          <div className={styles.titleCol}>
            <h1>מתי נוח לך ללמוד?</h1>
            <span className={styles.subtitle}>
              בוחרות ימים ושעה, ואפשר לשנות מתי שרוצות.
            </span>
          </div>
        </div>

        {/* Day picker */}
        <div className={styles.card}>
          <span className={styles.cardLabel}>באילו ימים?</span>
          <div id="day-picker" className={styles.dayRow}>
            {DAYS.map((label, i) => {
              const selected = scheduledDays.has(i);
              return (
                <button
                  key={i}
                  className={`day-btn ${styles.btnDay} ${selected ? styles.btnDaySelected : ""}`}
                  data-day={i}
                  data-selected={selected ? "true" : "false"}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span id="days-label" className={styles.daysLabel}>
            {scheduledDays.size > 0 ? `נבחרו ${scheduledDays.size} ימים` : "טרם נבחרו ימים"}
          </span>
        </div>

        {/* Time + duration */}
        <div className={styles.timeCard}>
          <label className={styles.timeLabel}>
            <span className={styles.cardLabel}>באיזו שעה?</span>
            <input
              type="time"
              id="time-input"
              defaultValue={startTime.slice(0, 5)}
              className={styles.timeInput}
            />
          </label>

          <div className={styles.durationWrapper}>
            <span className={styles.cardLabel}>כמה זמן בכל פעם?</span>
            <div id="duration-picker" className={styles.durationRow}>
              {DURATIONS.map((d) => {
                const active = d === duration;
                return (
                  <button
                    key={d}
                    className={`duration-btn ${styles.btnDuration} ${active ? styles.btnDurationActive : ""}`}
                    data-duration={d}
                    data-selected={active ? "true" : "false"}
                  >
                    {d} דק׳
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification toggle */}
          <label className={styles.notifyLabel}>
            <span
              id="notify-toggle"
              role="switch"
              aria-checked={notify ? "true" : "false"}
              data-on={notify ? "true" : "false"}
              className={`${styles.toggle} ${notify ? styles.toggleOn : ""}`}
            >
              <span className={`${styles.toggleThumb} ${notify ? styles.toggleThumbOn : ""}`} />
            </span>
            <span className={styles.notifyText}>תזכורת עדינה לפני כל מפגש</span>
          </label>
        </div>

        {/* Summary + save */}
        <div className={styles.saveArea}>
          <div id="schedule-summary" className={styles.summaryCard}>
            <span id="summary-text" className={styles.summaryText}>
              {scheduledDays.size > 0
                ? `${scheduledDays.size} מפגשים בשבוע, ${duration} דק׳ כל אחד`
                : "בחרי ימים כדי להתחיל"}
            </span>
            <span className={styles.summaryHint}>קצב נעים שמספיק בדיוק לחומר.</span>
          </div>
          <button id="save-schedule-btn" className="btn-primary">
            שמרי את התוכנית
          </button>
        </div>
      </main>

      <Script src="/js/push.js" strategy="afterInteractive" />
      <Script src="/js/schedule.js" strategy="afterInteractive" />
    </>
  );
}

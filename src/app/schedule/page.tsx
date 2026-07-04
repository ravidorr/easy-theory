import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import { getUserSchedule } from "@/lib/db";

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
      <main
        style={{
          background: "var(--bg)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "440px",
          margin: "0 auto",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/more"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              fontSize: "20px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            →
          </Link>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--type-h1-size)",
                fontWeight: "var(--type-h1-weight)" as never,
                lineHeight: "var(--line-tight)",
                color: "var(--text)",
              }}
            >
              מתי נוח לך ללמוד?
            </h1>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              בוחרות ימים ושעה, ואפשר לשנות מתי שרוצות.
            </span>
          </div>
        </div>

        {/* Day picker */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <span style={{ fontSize: "var(--type-small-size)", fontWeight: 600, color: "var(--text-muted)" }}>
            באילו ימים?
          </span>
          <div id="day-picker" style={{ display: "flex", justifyContent: "space-between", gap: "4px" }}>
            {DAYS.map((label, i) => {
              const selected = scheduledDays.has(i);
              return (
                <button
                  key={i}
                  className="day-btn"
                  data-day={i}
                  data-selected={selected ? "true" : "false"}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    border: selected ? "1px solid transparent" : "1px solid var(--border-strong)",
                    fontFamily: "var(--font-ui)",
                    fontWeight: selected ? 700 : 600,
                    fontSize: "15px",
                    cursor: "pointer",
                    background: selected ? "var(--primary)" : "var(--surface)",
                    color: selected ? "#fff" : "var(--text-muted)",
                    boxShadow: selected ? "var(--shadow-card)" : "none",
                    transition: "background 120ms, color 120ms, border-color 120ms",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span id="days-label" style={{ fontSize: "var(--type-caption-size)", fontWeight: "var(--type-caption-weight)" as never, color: "var(--text-faint)" }}>
            {scheduledDays.size > 0 ? `נבחרו ${scheduledDays.size} ימים` : "טרם נבחרו ימים"}
          </span>
        </div>

        {/* Time + duration */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "var(--type-small-size)", fontWeight: 600, color: "var(--text-muted)" }}>
              באיזו שעה?
            </span>
            <input
              type="time"
              id="time-input"
              defaultValue={startTime.slice(0, 5)}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "var(--type-body-size)",
                color: "var(--text)",
                background: "var(--surface)",
                border: "1.5px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "11px 14px",
                minHeight: "var(--hit-min)",
                boxSizing: "border-box",
                outline: "none",
                width: "100%",
              }}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "var(--type-small-size)", fontWeight: 600, color: "var(--text-muted)" }}>
              כמה זמן בכל פעם?
            </span>
            <div id="duration-picker" style={{ display: "flex", gap: "8px" }}>
              {DURATIONS.map((d) => {
                const active = d === duration;
                return (
                  <button
                    key={d}
                    className="duration-btn"
                    data-duration={d}
                    data-selected={active ? "true" : "false"}
                    style={{
                      flex: 1,
                      minHeight: "var(--hit-min)",
                      borderRadius: "var(--radius-pill)",
                      border: active ? "1px solid transparent" : "1px solid var(--border-strong)",
                      fontFamily: "var(--font-ui)",
                      fontWeight: active ? 700 : 600,
                      fontSize: "14px",
                      cursor: "pointer",
                      background: active ? "var(--primary)" : "var(--surface)",
                      color: active ? "#fff" : "var(--text-muted)",
                      boxShadow: active ? "var(--shadow-card)" : "none",
                      transition: "background 120ms",
                    }}
                  >
                    {d} דק׳
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification toggle */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer", minHeight: "var(--hit-min)" }}>
            <span
              id="notify-toggle"
              role="switch"
              aria-checked={notify ? "true" : "false"}
              data-on={notify ? "true" : "false"}
              style={{
                width: "46px",
                height: "28px",
                borderRadius: "var(--radius-pill)",
                position: "relative",
                background: notify ? "var(--primary)" : "var(--surface-3)",
                flexShrink: 0,
                display: "inline-block",
                transition: "background 150ms",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  insetInlineStart: notify ? "21px" : "3px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(24,32,60,0.25)",
                  transition: "inset-inline-start 150ms",
                }}
              />
            </span>
            <span style={{ fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              תזכורת עדינה לפני כל מפגש
            </span>
          </label>
        </div>

        {/* Summary + save */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            id="schedule-summary"
            style={{
              background: "var(--primary-soft)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span
              id="summary-text"
              style={{ fontSize: "var(--type-body-size)", fontWeight: 600, color: "var(--primary-soft-text)" }}
            >
              {scheduledDays.size > 0
                ? `${scheduledDays.size} מפגשים בשבוע, ${duration} דק׳ כל אחד`
                : "בחרי ימים כדי להתחיל"}
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              קצב נעים שמספיק בדיוק לחומר.
            </span>
          </div>
          <button id="save-schedule-btn" className="btn-primary">
            שמרי את התוכנית
          </button>
        </div>
      </main>

      <Script src="/js/schedule.js" strategy="afterInteractive" />
    </>
  );
}

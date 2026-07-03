import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getUserStats,
  getTopicProgress,
} from "@/lib/db";
import { TabBar } from "@/components/TabBar";

function PathProgress({ total = 5, current = 1 }: { total?: number; current?: number }) {
  const items = [];
  for (let i = 1; i <= total; i++) {
    const done = i < current;
    const active = i === current;
    items.push(
      <span
        key={`s${i}`}
        style={{
          width: active ? "44px" : "34px",
          height: active ? "44px" : "34px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: active ? "15px" : "14px",
          background: done ? "var(--primary)" : active ? "var(--surface)" : "var(--surface-2)",
          color: done ? "#fff" : active ? "var(--primary-soft-text)" : "var(--text-faint)",
          border: active ? "3px solid var(--primary)" : "3px solid transparent",
          boxShadow: active ? "var(--shadow-card)" : "none",
          boxSizing: "border-box",
        }}
      >
        {done ? "✓" : i === total ? "🏁" : i}
      </span>
    );
    if (i < total) {
      items.push(
        <span
          key={`c${i}`}
          style={{
            flex: 1,
            height: "4px",
            minWidth: "12px",
            background: i < current ? "var(--primary)" : "var(--surface-3)",
          }}
        />
      );
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>{items}</div>
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
  if (!user) redirect("/auth/login");

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

  return (
    <>
    <main
      style={{
        background: "var(--bg)",
        padding: "20px 20px 96px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "440px",
        margin: "0 auto",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <span style={{ fontWeight: 800, fontSize: "20px", color: "var(--text)" }}>דרך ברורה</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "var(--primary-soft)", color: "var(--primary-soft-text)",
              borderRadius: "var(--radius-pill)", padding: "6px 14px",
              fontWeight: 700, fontSize: "14px",
            }}
          >
            <FlameIcon />
            {stats.streak_days}
          </span>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "var(--gold-soft)", color: "var(--gold-text)",
              borderRadius: "var(--radius-pill)", padding: "6px 14px",
              fontWeight: 700, fontSize: "14px",
            }}
          >
            <StarIcon />
            {stats.star_points}
          </span>
        </div>
      </div>

      {/* Greeting */}
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
          {timeGreeting()}!
        </h1>
        <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
          {stats.streak_days === 0
            ? "יאללה, מתחילות ללמוד!"
            : stats.streak_days === 1
            ? "יום ראשון ברצף, ממשיכות בקצב שלך!"
            : `${stats.streak_days} ימים ברצף, ממשיכות בקצב שלך.`}
        </span>
      </div>

      {/* Today's task card */}
      {todayTopic ? (
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
          <span
            style={{
              alignSelf: "flex-start",
              background: "var(--primary-soft)",
              color: "var(--primary-soft-text)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 10px",
              fontSize: "var(--type-caption-size)",
              fontWeight: "var(--type-caption-weight)" as never,
            }}
          >
            המשימה להיום
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--type-h2-size)",
                fontWeight: "var(--type-h2-weight)" as never,
                lineHeight: "var(--line-tight)",
                color: "var(--text)",
              }}
            >
              {todayTopic.name_he}
            </h2>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
              8 שאלות תרגול · ~20 דק׳
            </span>
          </div>
          {/* Step path */}
          {(() => {
            const pct = progressMap[todayTopic.id]?.best_score ?? 0;
            const current = pct >= 100 ? 6 : pct >= 67 ? 4 : pct >= 34 ? 3 : pct >= 1 ? 2 : 1;
            return <PathProgress total={5} current={current} />;
          })()}
          <Link href={`/topics/${todayTopic.slug}`} style={{ textDecoration: "none" }}>
            <button className="btn-primary">יאללה, מתחילות!</button>
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: "var(--primary-soft)",
            borderRadius: "var(--radius-xl)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "var(--type-h2-size)",
              fontWeight: "var(--type-h2-weight)" as never,
              color: "var(--primary-soft-text)",
            }}
          >
            מתי נוח לך ללמוד?
          </h2>
          <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
            קבעי תוכנית שבועית ונתחיל.
          </span>
          <Link href="/schedule" style={{ textDecoration: "none" }}>
            <button className="btn-primary">קבעי תוכנית</button>
          </Link>
        </div>
      )}

      {/* Topics */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--type-h2-size)",
              fontWeight: "var(--type-h2-weight)" as never,
              color: "var(--text)",
            }}
          >
            הנושאים שלך
          </h2>
          <span
            style={{
              fontSize: "var(--type-caption-size)",
              fontWeight: "var(--type-caption-weight)" as never,
              color: "var(--text-faint)",
            }}
          >
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
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-card)",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                {topic.icon && (
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={topic.icon}
                      alt=""
                      style={{ width: "34px", height: "34px", objectFit: "contain" }}
                    />
                  </div>
                )}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--type-body-size)",
                        color: "var(--text)",
                      }}
                    >
                      {topic.name_he}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--type-caption-size)",
                        fontWeight: 600,
                        color: done ? "var(--success-text)" : "var(--text-faint)",
                        flexShrink: 0,
                      }}
                    >
                      {done ? "✓ הושלם" : pct > 0 ? `${pct}%` : "טרם התחלת"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--surface-2)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: "var(--radius-pill)",
                        background: done ? "var(--success)" : "var(--primary)",
                      }}
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

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getTopics, getTopicProgress } from "@/lib/db";
import { TabBar } from "@/components/TabBar";

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
      <h1
        style={{
          margin: 0,
          fontSize: "var(--type-h1-size)",
          fontWeight: "var(--type-h1-weight)" as never,
          color: "var(--text)",
        }}
      >
        הנושאים
      </h1>

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
            style={{ textDecoration: "none" }}
          >
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
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {topic.icon && (
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "var(--radius-lg)",
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
                      style={{ width: "40px", height: "40px", objectFit: "contain" }}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--type-h2-size)",
                        color: "var(--text)",
                      }}
                    >
                      {topic.name_he}
                    </span>
                    {done && (
                      <span
                        style={{
                          fontSize: "var(--type-caption-size)",
                          fontWeight: 600,
                          color: "var(--success-text)",
                        }}
                      >
                        ✓ הושלם
                      </span>
                    )}
                  </div>
                  {topic.description_he && (
                    <span
                      style={{
                        fontSize: "var(--type-small-size)",
                        color: "var(--text-muted)",
                        lineHeight: "var(--line-body)",
                      }}
                    >
                      {topic.description_he}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div
                  style={{
                    height: "8px",
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
                <span
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-faint)",
                  }}
                >
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

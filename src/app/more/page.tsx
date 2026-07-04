import { redirect } from "next/navigation";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { getUserMedals } from "@/lib/db";

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const medals = await getUserMedals(supabase, user.id);
  const earnedSet = new Set(medals.map((m) => m.medal_slug));
  const earnedDateMap = Object.fromEntries(medals.map((m) => [m.medal_slug, m.earned_at]));

  const cookieStore = await cookies();
  const isDark = (cookieStore.get("theme")?.value ?? "dark") === "dark";

  const MILESTONES = [
    { slug: "streak-3",  label: "3 ימים",   emoji: "🔥" },
    { slug: "streak-7",  label: "שבוע",      emoji: "⭐" },
    { slug: "streak-14", label: "שבועיים",   emoji: "💎" },
    { slug: "streak-30", label: "חודש",      emoji: "🏆" },
  ];

  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(iso));
  }

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
            lineHeight: "var(--line-tight)",
            color: "var(--text)",
          }}
        >
          עוד
        </h1>

        {/* Navigation rows */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <a
            href="/schedule"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              minHeight: "var(--hit-min)",
              boxSizing: "border-box",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-soft)",
                color: "var(--primary-soft-text)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 9h18" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: "var(--type-body-size)", fontWeight: 600, color: "var(--text)" }}>
              התוכנית שלך
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </a>

          <a
            href="/videos"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              minHeight: "var(--hit-min)",
              boxSizing: "border-box",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-soft)",
                color: "var(--primary-soft-text)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="3" /><path d="m14 12-4-2.5v5z" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: "var(--type-body-size)", fontWeight: 600, color: "var(--text)" }}>
              סרטוני לימוד
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </a>

          <a
            href="/resources"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              minHeight: "var(--hit-min)",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-soft)",
                color: "var(--primary-soft-text)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: "var(--type-body-size)", fontWeight: 600, color: "var(--text)" }}>
              חומרים שימושיים
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </a>
        </div>

        {/* Medals */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            padding: "20px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "var(--type-body-size)",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            הישגים
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
            }}
          >
            {MILESTONES.map(({ slug, label, emoji }) => {
              const earned = earnedSet.has(slug);
              const date = earnedDateMap[slug];
              return (
                <div
                  key={slug}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: earned ? "var(--gold-soft)" : "var(--surface-2)",
                      border: `3px solid ${earned ? "var(--gold)" : "var(--surface-3)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      boxShadow: earned ? "var(--shadow-card)" : "none",
                      filter: earned ? "none" : "grayscale(1)",
                      opacity: earned ? 1 : 0.45,
                    }}
                  >
                    {emoji}
                  </div>
                  <span
                    style={{
                      fontSize: "var(--type-caption-size)",
                      fontWeight: 600,
                      textAlign: "center",
                      lineHeight: 1.3,
                      color: earned ? "var(--text)" : "var(--text-faint)",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      textAlign: "center",
                      color: earned ? "var(--text-muted)" : "var(--text-faint)",
                    }}
                  >
                    {earned ? fmtDate(date) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              minHeight: "var(--hit-min)",
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: "var(--type-body-size)", fontWeight: 600, color: "var(--text)" }}>
              מצב כהה
            </span>
            <span
              id="dark-mode-toggle"
              role="switch"
              aria-checked={isDark ? "true" : "false"}
              style={{
                width: "46px",
                height: "28px",
                borderRadius: "var(--radius-pill)",
                position: "relative",
                background: isDark ? "var(--primary)" : "var(--surface-3)",
                flexShrink: 0,
                display: "inline-block",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  insetInlineStart: isDark ? "21px" : "3px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(24,32,60,0.25)",
                  transition: "inset-inline-start 150ms",
                }}
              />
            </span>
          </label>
        </div>

        <button
          id="logout-btn"
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: "15.5px",
            minHeight: "var(--hit-min)",
            padding: "10px 22px",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            color: "var(--danger-text)",
            alignSelf: "center",
          }}
        >
          יציאה מהחשבון
        </button>
      </main>

      <TabBar active="more" />
      <Script src="/js/more.js" strategy="afterInteractive" />
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" style={{ transform: "scaleX(-1)" }}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export default async function VideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
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
      {/* Top bar */}
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
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          →
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--type-h1-size)",
              fontWeight: "var(--type-h1-weight)" as never,
              lineHeight: "var(--line-tight)",
              color: "var(--text)",
            }}
          >
            סרטוני לימוד
          </h1>
          <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
            שיעורים קצרים ומרתונים, לפי נושא.
          </span>
        </div>
      </div>

      {/* Marathons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            color: "var(--text)",
          }}
        >
          מרתונים
        </h2>

        {/* Featured video */}
        <a
          href="https://www.youtube.com/watch?v=gd6ES_aAdI0"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--surface-2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.ytimg.com/vi/gd6ES_aAdI0/hqdefault.jpg"
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span
              style={{
                position: "absolute",
                insetInlineStart: "50%",
                top: "50%",
                transform: "translate(50%, -50%)",
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "rgba(24,32,60,0.65)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayIcon size={20} />
            </span>
            <span
              style={{
                position: "absolute",
                bottom: "10px",
                insetInlineStart: "10px",
                background: "rgba(24,32,60,0.75)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
                fontSize: "var(--type-caption-size)",
                fontWeight: "var(--type-caption-weight)" as never,
              }}
            >
              40 דק׳
            </span>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              מרתון הכנה למבחן התיאוריה
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              סיכום נושאי הליבה: זמני תגובה, הסחות דעת ועוד
            </span>
          </div>
        </a>

        {/* Row variant */}
        <a
          href="https://www.youtube.com/watch?v=WsVi4kEiaPE"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-card)",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "120px",
              aspectRatio: "16/9",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-2)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.ytimg.com/vi/WsVi4kEiaPE/hqdefault.jpg"
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span
              style={{
                position: "absolute",
                insetInlineStart: "50%",
                top: "50%",
                transform: "translate(50%, -50%)",
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: "rgba(24,32,60,0.65)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayIcon size={12} />
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)", lineHeight: "var(--line-tight)" }}>
              שיעור חזרה מרוכז
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              מעבר על חומר הליבה הנדרש למבחן
            </span>
          </div>
        </a>
      </div>

      {/* Topic lessons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            color: "var(--text)",
          }}
        >
          שיעורים לפי נושא
        </h2>

        {[
          {
            id: "vk37Vd80S2E",
            title: "מבוא לתמרורים",
            tag: "תמרורים",
          },
          {
            id: "Rp4wFyF-dok",
            title: "זכות קדימה בצמתים",
            tag: "זכות קדימה",
          },
          {
            id: "nwbIrAdn8Qc",
            title: "התנהגות בצמתים מורכבים",
            tag: "זכות קדימה",
          },
        ].map((video) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: "none",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "120px",
                aspectRatio: "16/9",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-2)",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <span
                style={{
                  position: "absolute",
                  insetInlineStart: "50%",
                  top: "50%",
                  transform: "translate(50%, -50%)",
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "rgba(24,32,60,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlayIcon size={12} />
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)", lineHeight: "var(--line-tight)" }}>
                {video.title}
              </span>
              <span
                style={{
                  alignSelf: "flex-start",
                  background: "var(--primary-soft)",
                  color: "var(--primary-soft-text)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 8px",
                  fontSize: "var(--type-caption-size)",
                  fontWeight: "var(--type-caption-weight)" as never,
                }}
              >
                {video.tag}
              </span>
            </div>
          </a>
        ))}
      </div>

      <span
        style={{
          fontSize: "var(--type-caption-size)",
          color: "var(--text-faint)",
          textAlign: "center",
          lineHeight: "var(--line-body)",
          marginTop: "auto",
        }}
      >
        הסרטונים נפתחים ביוטיוב
      </span>
    </main>
  );
}

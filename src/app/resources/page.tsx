import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const ExternalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M7 7h10v10" /><path d="M7 17 17 7" />
  </svg>
);

export default async function ResourcesPage() {
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
            חומרים שימושיים
          </h1>
          <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
            מקורות רשמיים ואתרי תרגול, הכל במקום אחד.
          </span>
        </div>
      </div>

      {/* Official sources */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            color: "var(--text)",
          }}
        >
          מקורות רשמיים
        </h2>

        <a
          href="https://www.gov.il/he/pages/tamrurim_7924_01_18"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
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
            <img src="/signs/sign-301.png" alt="" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              לוח התמרורים הרשמי
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              כל התמרורים בתוקף, משרד התחבורה
            </span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
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
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--radius-md)",
              background: "var(--primary-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 800,
              fontSize: "20px",
              color: "var(--primary-soft-text)",
            }}
          >
            ?
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              מאגר שאלות התיאוריה
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              יותר מ-1,800 שאלות אמיתיות מהמבחן
            </span>
          </div>
          <ExternalIcon />
        </a>
      </div>

      {/* Practice & reference */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            color: "var(--text)",
          }}
        >
          תרגול והעשרה
        </h2>

        <a
          href="https://m.noeg.co.il/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
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
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--radius-md)",
              background: "var(--success-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 800,
              fontSize: "18px",
              color: "var(--success-text)",
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              נוהג, סימולטור תרגול
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              מבחני דמה בתנאי אמת, בחינם
            </span>
          </div>
          <ExternalIcon />
        </a>

        <a
          href="https://he.wikipedia.org/wiki/%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
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
              fontWeight: 800,
              fontSize: "18px",
              color: "var(--text-muted)",
            }}
          >
            W
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--type-body-size)", color: "var(--text)" }}>
              ויקיפדיה: תמרורים בישראל
            </span>
            <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)", lineHeight: "var(--line-body)" }}>
              קטלוג מסודר של כל התמרורים לפי סוג
            </span>
          </div>
          <ExternalIcon />
        </a>
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
        הקישורים נפתחים בחלון חדש
      </span>
    </main>
  );
}

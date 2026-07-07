import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "דרך ברורה — לומדים לתיאוריה בלי לחץ",
  description:
    "אפליקציה חינמית ללימוד מבחן התיאוריה בישראל: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות תמרורים ותוכנית אישית בקצב שלך.",
  openGraph: {
    title: "דרך ברורה — לומדים לתיאוריה בלי לחץ",
    description:
      "אפליקציה חינמית ללימוד מבחן התיאוריה בישראל: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות תמרורים ותוכנית אישית בקצב שלך.",
    locale: "he_IL",
  },
};

export default function LoginPage() {
  return (
    <>
      <main
        style={{
          background: "var(--bg)",
          margin: "0 auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
          maxWidth: "420px",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        {/* Hero */}
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            textAlign: "center",
            paddingTop: "24px",
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: "var(--type-h2-size)",
              color: "var(--primary-soft-text)",
            }}
          >
            דרך ברורה
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--type-display-size)",
              fontWeight: "var(--type-display-weight)" as never,
              lineHeight: "var(--line-tight)",
              color: "var(--text)",
            }}
          >
            לומדים לתיאוריה,
            <br />
            בלי לחץ.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "var(--type-body-size)",
              color: "var(--text-muted)",
              lineHeight: "var(--line-body)",
              maxWidth: "320px",
            }}
          >
            כל מה שצריך למבחן התיאוריה: שאלות אמיתיות מהמאגר הרשמי, כרטיסיות
            תמרורים ותוכנית שמתאימה את עצמה לקצב שלך.
          </p>
        </header>

        {/* Login card */}
        <section
          aria-label="כניסה"
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
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--type-h2-size)",
                fontWeight: "var(--type-h2-weight)" as never,
                color: "var(--text)",
              }}
            >
              להתחיל עכשיו
            </h2>
            <span
              style={{
                fontSize: "var(--type-small-size)",
                color: "var(--text-muted)",
              }}
            >
              להתחברות עם קישור למייל, בלי סיסמה. חינם לגמרי.
            </span>
          </div>

          <form
            id="login-form"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "var(--type-small-size)",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                כתובת המייל שלך
              </span>
              <input
                type="email"
                name="email"
                id="email-input"
                placeholder="noa@example.com"
                dir="ltr"
                autoComplete="email"
                required
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
                  textAlign: "left",
                  width: "100%",
                }}
              />
            </label>
            <button type="submit" id="send-btn" className="btn-primary">
              שלחי לי קישור
            </button>
            <p
              id="login-error"
              role="alert"
              style={{
                display: "none",
                margin: 0,
                fontSize: "var(--type-small-size)",
                color: "var(--danger-text)",
                textAlign: "center",
              }}
            />
          </form>

          {/* Sent state — hidden until auth.js reveals it */}
          <div
            id="sent-banner"
            style={{
              display: "none",
              background: "var(--success-soft)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                background: "var(--success)",
                color: "#fff",
              }}
            >
              ✓
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "var(--type-body-size)",
                  fontWeight: 600,
                  color: "var(--success-text)",
                }}
              >
                הקישור בדרך אלייך
              </span>
              <span
                style={{
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  lineHeight: "var(--line-body)",
                }}
              >
                בדקי את המייל ולחצי על הקישור כדי להיכנס.
              </span>
              <span
                style={{
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                לא קיבלת?{" "}
                <button
                  id="resend-btn"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--primary-soft-text)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "inherit",
                    fontFamily: "inherit",
                  }}
                >
                  שלחי שוב
                </button>
                <span id="resend-msg" style={{ display: "none", marginRight: "6px" }} />
              </span>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section
          aria-label="מה מקבלים"
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "var(--type-h2-size)",
              fontWeight: "var(--type-h2-weight)" as never,
              color: "var(--text)",
            }}
          >
            מה מחכה לך בפנים
          </h2>

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
                src="/signs/sign-302.png"
                alt="תמרור עצור"
                style={{ width: "34px", height: "34px", objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h3
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "var(--type-body-size)",
                  color: "var(--text)",
                }}
              >
                שאלות אמיתיות מהמבחן
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  lineHeight: "var(--line-body)",
                }}
              >
                כל השאלות מהמאגר הרשמי של משרד התחבורה, עם הסבר לכל תשובה.
              </p>
            </div>
          </div>

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
                src="/signs/sign-303.png"
                alt="תמרור מעגל תנועה"
                style={{ width: "34px", height: "34px", objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h3
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "var(--type-body-size)",
                  color: "var(--text)",
                }}
              >
                כרטיסיות תמרורים
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  lineHeight: "var(--line-body)",
                }}
              >
                שינון תמרורים בשיטת חזרה מרווחת, מה שלא נזכר יחזור מחר.
              </p>
            </div>
          </div>

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
                color: "var(--primary-soft-text)",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <path d="M8 2v4M16 2v4M3 9h18" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h3
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "var(--type-body-size)",
                  color: "var(--text)",
                }}
              >
                תוכנית אישית בקצב שלך
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  lineHeight: "var(--line-body)",
                }}
              >
                בימים ושעות שנוח לך, והאפליקציה בונה תוכנית עד למבחן. בלי לחץ, ובלי ספירה לאחור.
              </p>
            </div>
          </div>
        </section>

        {/* Reassurance strip */}
        <section
          aria-label="בקצרה"
          style={{
            background: "var(--primary-soft)",
            borderRadius: "var(--radius-xl)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--type-body-size)",
              color: "var(--primary-soft-text)",
            }}
          >
            חינם, בעברית, בגובה העיניים.
          </span>
          <span
            style={{
              fontSize: "var(--type-small-size)",
              color: "var(--text-muted)",
              lineHeight: "var(--line-body)",
            }}
          >
            נבנה בשביל הנהגות והנהגים שבדרך.
          </span>
        </section>

        <footer
          style={{
            marginTop: "auto",
            paddingBottom: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-faint)",
            }}
          >
            ClearRoad · דרך ברורה
          </span>
          <span
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-faint)",
            }}
          >
            לימוד לתיאוריה לרכב פרטי בישראל
          </span>
        </footer>
      </main>

      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}

import Script from "next/script";

export default function LoginPage() {
  return (
    <>
      <main
        style={{
          background: "var(--bg)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          maxWidth: "420px",
          margin: "0 auto",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          {/* Wordmark + welcome */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: "var(--type-display-size)",
                color: "var(--primary-soft-text)",
              }}
            >
              דרך ברורה
            </span>
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
                טוב שבאת!
              </h1>
              <span
                style={{
                  fontSize: "var(--type-small-size)",
                  color: "var(--text-muted)",
                  lineHeight: "var(--line-body)",
                }}
              >
                מתחברות עם קישור למייל, בלי סיסמה.
              </span>
            </div>
          </div>

          {/* Email form */}
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
            <form id="login-form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
              <button
                type="submit"
                id="send-btn"
                className="btn-primary"
              >
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
          </div>

          {/* Sent state — hidden until JS reveals it */}
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
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-faint)",
            textAlign: "center",
            paddingBottom: "8px",
          }}
        >
          ClearRoad
        </span>
      </main>

      <Script src="/js/auth.js" strategy="afterInteractive" />
    </>
  );
}

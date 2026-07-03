import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import { getSigns } from "@/lib/db";
import type { Sign } from "@/lib/db";

function cleanName(name: string, signNumber: string): string {
  if (/^\d+$/.test(name.trim())) return `תמרור ${signNumber}`;
  const firstClause = name.split(/[,.(]/)[0].trim().replace(/\s+/g, " ");
  return firstClause.length > 55 ? firstClause.slice(0, 52) + "…" : firstClause;
}

function SignCard({ sign, index }: { sign: Sign; index: number }) {
  return (
    <div
      className="flashcard-wrap"
      data-index={index}
      style={{ display: index === 0 ? "flex" : "none", alignItems: "center", justifyContent: "center", flex: 1 }}
    >
      <div className="flashcard-inner">
        {/* Front */}
        <div className="flashcard-face">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sign.image_path}
            alt={sign.name_he}
            style={{ width: "65%", maxHeight: "60%", objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: "var(--type-caption-size)",
              fontWeight: 600,
              color: "var(--text-faint)",
            }}
          >
            הקליקי להיפוך
          </span>
        </div>
        {/* Back */}
        <div className="flashcard-face flashcard-back-face">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sign.image_path}
            alt={sign.name_he}
            style={{ width: "45%", maxHeight: "40%", objectFit: "contain", opacity: 0.35 }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: "var(--type-h2-size)",
              fontWeight: "var(--type-h2-weight)" as never,
              color: "var(--text)",
              lineHeight: "var(--line-tight)",
              textAlign: "center",
            }}
          >
            {cleanName(sign.name_he, sign.sign_number)}
          </h2>
          <span
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-faint)",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 8px",
            }}
          >
            תמרור {sign.sign_number}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const signs = await getSigns(supabase, 277);
  const total = signs.length;

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
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/"
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: "var(--type-body-size)",
                color: "var(--text)",
              }}
            >
              תמרורים: חזרה
            </span>
            <span
              id="fc-count"
              style={{
                fontSize: "var(--type-caption-size)",
                fontWeight: "var(--type-caption-weight)" as never,
                color: "var(--text-faint)",
              }}
            >
              כרטיס 1 מתוך {total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-2)",
            overflow: "hidden",
          }}
        >
          <div
            id="fc-progress"
            style={{
              width: total > 0 ? `${(1 / total) * 100}%` : "0%",
              height: "100%",
              borderRadius: "var(--radius-pill)",
              background: "var(--gold)",
              transition: "width 300ms ease",
            }}
          />
        </div>

        {/* Cards */}
        <div
          id="flashcards-container"
          data-total={total}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {signs.map((sign, i) => (
            <SignCard key={sign.id} sign={sign} index={i} />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            id="fc-no"
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            עוד לא
          </button>
          <button
            id="fc-yes"
            style={{
              flex: 1,
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: "15.5px",
              minHeight: "52px",
              padding: "10px 22px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid transparent",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--success)",
              color: "#fff",
              transition: "background 120ms",
            }}
          >
            ידעתי ✓
          </button>
        </div>
        <span
          style={{
            fontSize: "var(--type-small-size)",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          כרטיסים שסימנת &quot;עוד לא&quot; יחזרו אלייך מחר.
        </span>
      </main>

      <Script src="/js/flashcard.js" strategy="afterInteractive" />
    </>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getSigns } from "@/lib/db";
import type { Sign } from "@/lib/db";
import styles from "./page.module.css";

function cleanName(name: string, signNumber: string): string {
  if (/^\d+$/.test(name.trim())) return `תמרור ${signNumber}`;
  const firstClause = name.split(/[,.(]/)[0].trim().replace(/\s+/g, " ");
  return firstClause.length > 55 ? firstClause.slice(0, 52) + "…" : firstClause;
}

function SignCard({ sign, index }: { sign: Sign; index: number }) {
  return (
    <div
      className={`flashcard-wrap ${styles.flashcardItem}`}
      data-index={index}
      style={{ display: index === 0 ? "flex" : "none" }}
    >
      <div className="flashcard-inner">
        {/* Front */}
        <div className="flashcard-face">
          <SignImage
            src={sign.image_path}
            alt={sign.name_he}
            size="md"
            style={{ width: "65%", maxHeight: "60%" }}
          />
          <span className={styles.flashcardHint}>הקליקי להיפוך</span>
        </div>
        {/* Back */}
        <div className="flashcard-face flashcard-back-face">
          <SignImage
            src={sign.image_path}
            alt={sign.name_he}
            size="md"
            style={{ width: "45%", maxHeight: "40%", opacity: 0.35 }}
          />
          <h2 className={styles.flashcardBackH2}>
            {cleanName(sign.name_he, sign.sign_number)}
          </h2>
          <span className={styles.signNumberBadge}>תמרור {sign.sign_number}</span>
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
      <main className={styles.page}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <Link href="/" className={styles.backBtn}>
            →
          </Link>
          <div className={styles.topBarBody}>
            <span className={styles.topBarTitle}>תמרורים: חזרה</span>
            <span id="fc-count" className={styles.topBarCount}>
              כרטיס 1 מתוך {total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div
            id="fc-progress"
            className={styles.progressFill}
            style={{ width: total > 0 ? `${(1 / total) * 100}%` : "0%" }}
          />
        </div>

        {/* Cards */}
        <div
          id="flashcards-container"
          data-total={total}
          className={styles.cardsContainer}
        >
          {signs.map((sign, i) => (
            <SignCard key={sign.id} sign={sign} index={i} />
          ))}
        </div>

        {/* Actions */}
        <div className={styles.actionsRow}>
          <button id="fc-no" className={`btn-secondary ${styles.btnSecondaryFlex}`}>
            עוד לא
          </button>
          <button id="fc-yes" className={styles.btnYes}>
            ידעתי ✓
          </button>
        </div>
        <span className={styles.footerNote}>
          כרטיסים שסימנת &quot;עוד לא&quot; יחזרו אלייך מחר.
        </span>
      </main>

      <Script src="/js/flashcard.js" strategy="afterInteractive" />
    </>
  );
}

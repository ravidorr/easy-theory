import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getSigns } from "@/lib/db";
import type { Sign } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import styles from "./page.module.css";

function cleanName(name: string, fallback: string): string {
  if (/^\d+$/.test(name.trim())) return fallback;
  const firstClause = name.split(/[,.(]/)[0].trim().replace(/\s+/g, " ");
  return firstClause.length > 55 ? firstClause.slice(0, 52) + "…" : firstClause;
}

function SignCard({
  sign,
  index,
  signBadgeLabel,
  flipHint,
}: {
  sign: Sign;
  index: number;
  signBadgeLabel: string;
  flipHint: string;
}) {
  return (
    <div
      className={`flashcard-wrap ${styles.flashcardItem}`}
      data-index={index}
      style={{ display: index === 0 ? "flex" : "none" }}
    >
      <div className="flashcard-inner">
        <div className="flashcard-face">
          <SignImage
            src={sign.image_path}
            alt={sign.name_he}
            size="md"
            style={{ width: "65%", maxHeight: "60%" }}
          />
          <span className={styles.flashcardHint}>{flipHint}</span>
        </div>
        <div className="flashcard-face flashcard-back-face">
          <SignImage
            src={sign.image_path}
            alt={sign.name_he}
            size="md"
            style={{ width: "45%", maxHeight: "40%", opacity: 0.35 }}
          />
          <h2 className={styles.flashcardBackH2}>
            {cleanName(sign.name_he, signBadgeLabel)}
          </h2>
          <span className={styles.signNumberBadge}>{signBadgeLabel}</span>
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
  if (!user) redirect("/auth/login?next=/flashcards");

  const t = await getTranslations("Flashcards");
  const locale = await getLocale();

  const signs = await getSigns(supabase, 277);
  const total = signs.length;

  // Use Arabic sign name if available
  const nameField = locale === "ar" ? "name_ar" : "name_he";

  function getSignName(sign: Sign): string {
    const signAny = sign as Record<string, unknown>;
    return (signAny[nameField] as string) ?? sign.name_he;
  }

  return (
    <>
      <main className={styles.page}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backBtn} aria-label={t("backLabel")}>
            →
          </Link>
          <div className={styles.topBarBody}>
            <span className={styles.topBarTitle}>{t("topBarTitle")}</span>
            <span id="fc-count" className={styles.topBarCount}>
              {t("cardCount", { current: 1, total })}
            </span>
          </div>
        </div>

        <div className={styles.progressTrack}>
          <div
            id="fc-progress"
            className={styles.progressFill}
            style={{ width: total > 0 ? `${(1 / total) * 100}%` : "0%" }}
          />
        </div>

        <div
          id="flashcards-container"
          data-total={total}
          className={styles.cardsContainer}
        >
          {signs.map((sign, i) => (
            <SignCard
              key={sign.id}
              sign={{ ...sign, name_he: getSignName(sign) }}
              index={i}
              signBadgeLabel={t("signBadge", { number: sign.sign_number })}
              flipHint={t("flipHint")}
            />
          ))}
        </div>

        <div className={styles.actionsRow}>
          <button id="fc-no" className={`btn-secondary ${styles.btnSecondaryFlex}`}>
            {t("btnNo")}
          </button>
          <button id="fc-yes" className={styles.btnYes}>
            {t("btnYes")}
          </button>
        </div>
        <span className={styles.footerNote}>{t("footerNote")}</span>
      </main>

      <Script src="/js/flashcard.js" strategy="afterInteractive" />
    </>
  );
}

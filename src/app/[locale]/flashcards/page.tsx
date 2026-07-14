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

type FlashcardData = {
  img: string;
  alt: string;
  name: string;
  badge: string;
};

function SignCard({ card, flipHint }: { card: FlashcardData; flipHint: string }) {
  return (
    <div
      className={`flashcard-wrap ${styles.flashcardItem}`}
      data-index={0}
      style={{ display: "flex" }}
    >
      <div className="flashcard-inner">
        <div className="flashcard-face">
          <SignImage
            src={card.img}
            alt={card.alt}
            size="md"
            className="fc-front-img"
            style={{ width: "65%", maxHeight: "60%" }}
          />
          <span className={styles.flashcardHint}>{flipHint}</span>
        </div>
        <div className="flashcard-face flashcard-back-face">
          <SignImage
            src={card.img}
            alt={card.alt}
            size="md"
            className="fc-back-img"
            style={{ width: "45%", maxHeight: "40%", opacity: 0.35 }}
          />
          <h2 id="fc-name" className={styles.flashcardBackH2}>
            {card.name}
          </h2>
          <span id="fc-badge" className={styles.signNumberBadge}>
            {card.badge}
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

  const cards: FlashcardData[] = signs.map((sign) => {
    const localizedName = getSignName(sign);
    const badge = t("signBadge", { number: sign.sign_number });
    return {
      img: sign.image_path,
      alt: localizedName,
      name: cleanName(localizedName, badge),
      badge,
    };
  });
  // Escape "<" so DB content can't break out of the inline <script> payload.
  const cardsJson = JSON.stringify(cards).replace(/</g, "\\u003c");

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
          {total > 0 && <SignCard card={cards[0]} flipHint={t("flipHint")} />}
        </div>

        <script
          type="application/json"
          id="fc-data"
          dangerouslySetInnerHTML={{ __html: cardsJson }}
        />

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

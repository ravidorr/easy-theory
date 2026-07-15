import { redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getSigns, getSignSrsCards } from "@/lib/db";
import type { Sign, SrsCard } from "@/lib/db";
import { isDue } from "@/lib/srs";
import { getTranslations, getLocale } from "next-intl/server";
import { localizedRecordField } from "@/lib/content-locale";
import styles from "./page.module.css";

function cleanName(name: string, fallback: string): string {
  if (/^\d+$/.test(name.trim())) return fallback;
  const firstClause = name.split(/[,.(]/)[0].trim().replace(/\s+/g, " ");
  return firstClause.length > 55 ? firstClause.slice(0, 52) + "…" : firstClause;
}

type FlashcardData = {
  id: string;
  img: string;
  alt: string;
  name: string;
  badge: string;
};

/** SRS deck order: due cards first (oldest due first), then never-seen
 * signs in catalog order, then not-yet-due cards by upcoming due date. */
function orderDeck(signs: Sign[], srsCards: SrsCard[]): { deck: Sign[]; dueCount: number } {
  const cardBySign = new Map(
    srsCards.filter((c) => c.sign_id != null).map((c) => [c.sign_id!, c])
  );
  const dueTime = (s: Sign) => Date.parse(cardBySign.get(s.id)!.due_at);

  const due = signs
    .filter((s) => cardBySign.has(s.id) && isDue(cardBySign.get(s.id)!.due_at))
    .sort((a, b) => dueTime(a) - dueTime(b));
  const fresh = signs.filter((s) => !cardBySign.has(s.id));
  const later = signs
    .filter((s) => cardBySign.has(s.id) && !isDue(cardBySign.get(s.id)!.due_at))
    .sort((a, b) => dueTime(a) - dueTime(b));

  return { deck: [...due, ...fresh, ...later], dueCount: due.length };
}

function SignCard({ card, flipHint }: { card: FlashcardData; flipHint: string }) {
  return (
    <button
      type="button"
      className={`flashcard-wrap ${styles.flashcardItem}`}
      data-index={0}
      aria-label={flipHint}
      aria-expanded="false"
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
          <span className={styles.flashcardHint} aria-hidden="true">
            {flipHint}
          </span>
        </div>
        <div className="flashcard-face flashcard-back-face" aria-hidden="true">
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
    </button>
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

  const [signs, srsCards] = await Promise.all([
    getSigns(supabase, 277),
    getSignSrsCards(supabase, user.id),
  ]);
  const { deck, dueCount } = orderDeck(signs, srsCards);
  const total = deck.length;

  function getSignName(sign: Sign): string {
    return localizedRecordField(
      locale,
      sign as Record<string, unknown>,
      "name_he",
      "name_ar"
    );
  }

  const cards: FlashcardData[] = deck.map((sign) => {
    const localizedName = getSignName(sign);
    const badge = t("signBadge", { number: sign.sign_number });
    return {
      id: sign.id,
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

        {dueCount > 0 && (
          <span className={styles.dueNote}>{t("dueToday", { count: dueCount })}</span>
        )}

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

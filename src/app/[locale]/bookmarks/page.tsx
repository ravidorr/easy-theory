import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { Icon } from "@/components/Icon";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getBookmarkedQuestions } from "@/lib/db";
import type { BookmarkedQuestion } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import styles from "./page.module.css";

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/questions/")) {
    if (!existsSync(join(process.cwd(), "public", url))) return "/placeholder.svg";
  }
  return url;
}

function resolveOptionSignImage(text: string): string | null {
  if (!/^\d{2,4}$/.test(text.trim())) return null;
  const path = join(process.cwd(), "public", "signs", `sign-${text.trim()}.png`);
  return existsSync(path) ? `/signs/sign-${text.trim()}.png` : null;
}

function signNumberFromUrl(url: string): string | null {
  return url.match(/sign-(\d{2,4})/)?.[1] ?? null;
}

// The sign number identifies the image for screen readers without revealing
// its meaning — a full description would give away the answer.
type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function BookmarkCard({
  question,
  letters,
  t,
}: {
  question: BookmarkedQuestion;
  letters: string[];
  t: TranslateFn;
}) {
  const qAny = question as Record<string, unknown>;
  const options: [string, string][] = [
    ["a", (qAny.option_a_display as string) ?? question.option_a],
    ["b", (qAny.option_b_display as string) ?? question.option_b],
    ["c", (qAny.option_c_display as string) ?? question.option_c],
    ["d", (qAny.option_d_display as string) ?? question.option_d],
  ];

  const isSignQuestion =
    question.image_url?.includes("/signs/") &&
    [question.option_a, question.option_b, question.option_c, question.option_d].some((t) => /^\d{2,4}$/.test(t.trim()));
  const imageUrl = isSignQuestion ? null : resolveImageUrl(question.image_url);
  const isWide = imageUrl && !imageUrl.includes("sign-");
  const signNumber = imageUrl ? signNumberFromUrl(imageUrl) : null;
  const signAlt = signNumber ? t("signAlt", { number: signNumber }) : t("questionImageAlt");

  const questionText = (qAny.question_display as string) ?? question.question_he;
  const explanationText = (qAny.explanation_display as string) ?? question.explanation_he;

  return (
    <div className={styles.questionCard}>
      <button
        type="button"
        className={`bookmark-toggle ${styles.bookmarkCorner}`}
        data-question-id={question.id}
        aria-pressed="true"
        aria-label={t("bookmarkLabel")}
      >
        <Icon name="bookmark" size={20} />
      </button>
      {imageUrl && (
        isWide ? (
          <div className={styles.imgWide}>
            <Image
              src={imageUrl}
              alt={t("questionImageAlt")}
              width={480}
              height={270}
              sizes="(max-width: 480px) 100vw, 440px"
              className={styles.imgEl}
            />
          </div>
        ) : (
          <div className={styles.imgSquare}>
            <SignImage src={imageUrl!} alt={signAlt} size="md" />
          </div>
        )
      )}

      <h3>{questionText}</h3>

      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text);
          const state = key === question.correct_option ? "correct" : undefined;

          return (
            <div
              key={key}
              className={`quiz-option ${styles.optionStatic}`}
              data-state={state}
            >
              <span className="quiz-option-badge">{letters[i]}</span>
              {optionSignImg ? (
                <span className={styles.optionSignContent}>
                  <SignImage src={optionSignImg} size="md" />
                  <span className={styles.optionSignLabel}>{text}</span>
                </span>
              ) : (
                <span className={styles.optionTextContent}>{text}</span>
              )}
              {state === "correct" && explanationText && (
                <span className="quiz-option-explanation">
                  <InlineMarkdown>{explanationText}</InlineMarkdown>
                </span>
              )}
              {state === "correct" && (
                <span className="sr-only">{t("optionCorrectSr")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/bookmarks");

  const locale = await getLocale();
  const t = await getTranslations("Bookmarks");
  const tQuiz = await getTranslations("Quiz");

  const bookmarks = await getBookmarkedQuestions(supabase, user.id);

  const questionField = locale === "ar" ? "question_ar" : "question_he";
  const explanationField = locale === "ar" ? "explanation_ar" : "explanation_he";
  const letters = tQuiz("letters").split(",");

  const localizedBookmarks = bookmarks.map((q) => {
    const qAny = q as Record<string, unknown>;
    return {
      ...q,
      question_display: qAny[questionField] as string ?? q.question_he,
      explanation_display: qAny[explanationField] as string ?? q.explanation_he,
      option_a_display: locale === "ar" ? ((qAny.option_a_ar as string) ?? q.option_a) : q.option_a,
      option_b_display: locale === "ar" ? ((qAny.option_b_ar as string) ?? q.option_b) : q.option_b,
      option_c_display: locale === "ar" ? ((qAny.option_c_ar as string) ?? q.option_c) : q.option_c,
      option_d_display: locale === "ar" ? ((qAny.option_d_ar as string) ?? q.option_d) : q.option_d,
    };
  });

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/more" className={styles.closeBtn} aria-label={tQuiz("closeLabel")}>
          ✕
        </Link>
        <h1>{t("topBarTitle")}</h1>
      </div>

      {localizedBookmarks.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyHint}>{t("emptyHint")}</p>
          <Link href="/" className={`btn-primary ${styles.btnWide}`}>
            {t("backHome")}
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.bookmarkCount}>
            {localizedBookmarks.length === 1
              ? t("countOne")
              : t("countMany", { count: localizedBookmarks.length })}
          </p>
          {localizedBookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} question={bookmark} letters={letters} t={tQuiz} />
          ))}
          <Link href="/" className={`btn-primary ${styles.btnFull} ${styles.returnLink}`}>
            {t("backHome")}
          </Link>
        </>
      )}

      <Script src="/js/bookmark.js" strategy="afterInteractive" />
    </main>
  );
}

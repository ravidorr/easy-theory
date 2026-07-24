import { redirect } from "next/navigation";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { QuestionImage } from "@/components/QuestionImage";
import { Icon } from "@/components/Icon";
import { TabBar } from "@/components/TabBar";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getBookmarkedQuestions, getTopics } from "@/lib/db";
import type { BookmarkedQuestion } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { localizeQuestion } from "@/lib/content-locale";
import { resolveOptionSignImage } from "@/lib/option-sign-image";
import { shouldSuppressQuestionImage } from "@/lib/question-image";
import styles from "./page.module.css";

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/questions/")) {
    if (!existsSync(join(process.cwd(), "public", url))) return "/placeholder.svg";
  }
  return url;
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
  isSignsTopic,
}: {
  question: BookmarkedQuestion;
  letters: string[];
  t: TranslateFn;
  isSignsTopic: boolean;
}) {
  const qAny = question as Record<string, unknown>;
  const options: [string, string][] = [
    ["a", (qAny.option_a_display as string) ?? question.option_a],
    ["b", (qAny.option_b_display as string) ?? question.option_b],
    ["c", (qAny.option_c_display as string) ?? question.option_c],
    ["d", (qAny.option_d_display as string) ?? question.option_d],
  ];

  const suppressQuestionImage = shouldSuppressQuestionImage(question.image_url, [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ]);
  const imageUrl = suppressQuestionImage ? null : resolveImageUrl(question.image_url);
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
            <QuestionImage
              src={imageUrl}
              alt={t("questionImageAlt")}
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
          const optionSignImg = resolveOptionSignImage(text, isSignsTopic);
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

  const [bookmarks, topics] = await Promise.all([
    getBookmarkedQuestions(supabase, user.id),
    getTopics(supabase),
  ]);
  const signTopicIds = new Set(topics.filter((topic) => topic.slug === "signs").map((topic) => topic.id));

  const letters = tQuiz("letters").split(",");

  const localizedBookmarks = bookmarks.map((q) => ({
    ...q,
    ...localizeQuestion(locale, q as Record<string, unknown>),
  }));

  return (
    <>
      <main className={styles.page}>
        <h1>{t("topBarTitle")}</h1>

        {localizedBookmarks.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyHint}>{t("emptyHint")}</p>
          </div>
        ) : (
          <>
            <p className={styles.bookmarkCount}>
              {localizedBookmarks.length === 1
                ? t("countOne")
                : t("countMany", { count: localizedBookmarks.length })}
            </p>
            {localizedBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                question={bookmark}
                letters={letters}
                t={tQuiz}
                isSignsTopic={signTopicIds.has(bookmark.topic_id)}
              />
            ))}
          </>
        )}

        <Script src="/js/bookmark.js" strategy="afterInteractive" />
      </main>
      <TabBar active="more" current={null} />
    </>
  );
}

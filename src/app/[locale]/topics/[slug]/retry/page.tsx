import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { QuestionImage } from "@/components/QuestionImage";
import { Icon } from "@/components/Icon";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic, getBookmarkedQuestionIds } from "@/lib/db";
import type { MistakeScope, Question } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { localizeQuestion } from "@/lib/content-locale";
import { resolveOptionSignImage } from "@/lib/option-sign-image";
import { shouldSuppressQuestionImage } from "@/lib/question-image";
import styles from "../page.module.css";

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

function QuestionSlide({
  question,
  index,
  topicId,
  isSignsTopic,
  letters,
  bookmarked,
  t,
}: {
  question: Question;
  index: number;
  topicId: string;
  isSignsTopic: boolean;
  letters: string[];
  bookmarked: boolean;
  t: TranslateFn;
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
    <div
      className={`quiz-slide ${styles.slideItem}`}
      data-index={index}
      data-question-id={question.id}
      data-topic-id={topicId}
      data-correct={question.correct_option}
      style={{ display: index === 0 ? "flex" : "none" }}
    >
      <div className={styles.questionContainer}>
        <div className={styles.questionActions}>
          <button
            type="button"
            className={`bookmark-toggle ${styles.bookmarkCorner}`}
            data-question-id={question.id}
            aria-pressed={bookmarked ? "true" : "false"}
            aria-label={t("bookmarkLabel")}
            title={t("bookmarkTooltip")}
          >
            <Icon name="bookmark" size={20} />
          </button>
          <button
            type="button"
            className={`report-question ${styles.reportQuestion}`}
            data-question-id={question.id}
            data-topic-id={topicId}
            aria-haspopup="dialog"
            aria-label={t("reportQuestionLabel")}
            title={t("reportQuestionTooltip")}
          >
            {t("reportQuestionLabel")}
          </button>
        </div>
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
        <h2>{questionText}</h2>
      </div>

      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text, isSignsTopic);
          return (
            <button key={key} className="quiz-option" data-option={key} aria-pressed="false">
              <span className="quiz-option-badge">{letters[i]}</span>
              {optionSignImg ? (
                <span className={styles.optionSignContent}>
                  <SignImage src={optionSignImg} alt={t("signAlt", { number: text.trim() })} size="md" />
                </span>
              ) : (
                <span className={styles.optionTextContent}>{text}</span>
              )}
              {explanationText && (
                <span className="quiz-option-explanation">
                  <InlineMarkdown>{explanationText}</InlineMarkdown>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default async function RetryMistakesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ scope?: string }>;
}) {
  const { slug } = await params;
  const { scope: scopeParam } = (await searchParams) ?? {};
  const scope: MistakeScope = scopeParam === "all" ? "all" : "lastSession";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const retryHref = `/topics/${slug}/retry${scope === "all" ? "?scope=all" : ""}`;
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(retryHref)}`);

  const locale = await getLocale();
  const tQuiz = await getTranslations("Quiz");
  const tRetry = await getTranslations("Retry");

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const [mistakes, bookmarkedIds] = await Promise.all([
    getMistakesForTopic(supabase, user.id, topic.id, scope),
    getBookmarkedQuestionIds(supabase, user.id),
  ]);
  const reviewHref = `/topics/${slug}/review${scope === "all" ? "?scope=all" : ""}`;
  if (mistakes.length === 0) redirect(reviewHref);

  const total = mistakes.length;
  const letters = tQuiz("letters").split(",");

  const localizedMistakes = mistakes.map((q) => ({
    ...q,
    ...localizeQuestion(locale, q as Record<string, unknown>),
  }));

  return (
    <>
      <main
        id="quiz-container"
        data-topic-id={topic.id}
        data-total={total}
        data-quiz-mode="retry"
        className={styles.page}
      >
        <div className={styles.topBar}>
          <Link href={reviewHref} className={`icon-btn ${styles.closeBtn}`} aria-label={tQuiz("closeLabel")}>
            <Icon name="close" size={20} />
          </Link>
          <div className={styles.progressTrack}>
            <div
              id="quiz-progress-fill"
              className={styles.progressFill}
              style={{ width: `${(1 / total) * 100}%` }}
            />
          </div>
          <span id="quiz-count" className={styles.quizCount}>
            {tQuiz("count", { current: 1, total })}
          </span>
        </div>

        {localizedMistakes.map((q, i) => (
          <QuestionSlide
            key={q.id}
            question={q}
            index={i}
            topicId={topic.id}
            isSignsTopic={topic.slug === "signs"}
            letters={letters}
            bookmarked={bookmarkedIds.has(q.id)}
            t={tQuiz}
          />
        ))}

        <div id="quiz-footer" className={styles.quizFooter}>
          <div id="reward-banner" className={styles.rewardBanner}>
            <span className={styles.rewardPill} aria-label={tQuiz("scoreLabel")}>
              <Icon name="star" size={12} />
              <span id="reward-score">0</span>
              <span id="reward-float" className={styles.rewardFloat} aria-hidden="true">+10</span>
            </span>
            <span id="reward-message" className={styles.rewardMsg} aria-live="polite"></span>
          </div>

          <button id="quiz-next" className="btn-primary" disabled>
            {tQuiz("nextBtn")}
          </button>
        </div>

        <div id="quiz-final" className={`${styles.hidden} ${styles.quizFinal}`} tabIndex={-1}>
          <Icon name="target" size={48} className={styles.finalIcon} />
          <h2>{tRetry("finalTitle")}</h2>
          <span className={styles.finalScore}>
            <span id="final-score"></span>
          </span>
          <Link href={reviewHref} className={`btn-primary ${styles.btnWide}`}>
            {tRetry("finalBackReview")}
          </Link>
          <Link href="/" className={`btn-secondary ${styles.btnWide}`}>
            {tRetry("finalBackHome")}
          </Link>
        </div>
      </main>

      <Script src="/js/medal.js" strategy="afterInteractive" />
      <Script src="/js/quiz.js" strategy="afterInteractive" />
      <Script src="/js/bookmark.js" strategy="afterInteractive" />
      <Script src="/js/question-report.js" strategy="afterInteractive" />
    </>
  );
}

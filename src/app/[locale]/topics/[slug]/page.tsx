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
import { getQuestionsForTopic, getBookmarkedQuestionIds, getAnsweredQuestionIdsForTopic, getTopics, getTopicProgress } from "@/lib/db";
import type { Question } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { localizeQuestion, localizedRecordField } from "@/lib/content-locale";
import { resolveOptionSignImage } from "@/lib/option-sign-image";
import { selectNextTopic } from "@/lib/personalization";
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
        <button
          type="button"
          className={`bookmark-toggle ${styles.bookmarkCorner}`}
          data-question-id={question.id}
          aria-pressed={bookmarked ? "true" : "false"}
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

export default async function TopicQuizPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/topics/${slug}`);

  const locale = await getLocale();
  const t = await getTranslations("Quiz");

  const topics = await getTopics(supabase);
  const topic = topics.find((candidate) => candidate.slug === slug);
  if (!topic) notFound();

  const [questions, bookmarkedIds, answeredIds, progressRows] = await Promise.all([
    getQuestionsForTopic(supabase, topic.id),
    getBookmarkedQuestionIds(supabase, user.id),
    getAnsweredQuestionIdsForTopic(supabase, user.id, topic.id),
    // The next-lesson suggestion is decorative; a progress failure must not
    // take down the quiz (same trade-off as getBookmarkedQuestionIds).
    getTopicProgress(supabase, user.id).catch(() => []),
  ]);
  const total = questions.length;

  const progressMap = Object.fromEntries(progressRows.map((p) => [p.topic_id, p]));
  const nextTopic = selectNextTopic(topics, progressMap, topic.id);

  const letters = t("letters").split(",");

  const localizedQuestions = questions.map((q) => ({
    ...q,
    ...localizeQuestion(locale, q as Record<string, unknown>),
  }));

  return (
    <>
      <main
        id="quiz-container"
        data-topic-id={topic.id}
        data-total={total}
        data-user-id={user.id}
        data-answered-ids={JSON.stringify([...answeredIds])}
        data-answered-count={answeredIds.size}
        className={styles.page}
      >
        <div className={styles.topBar}>
          <a href={`/${locale}`} className={`icon-btn ${styles.closeBtn}`} aria-label={t("closeLabel")}>
            <Icon name="close" size={20} />
          </a>
          <div className={styles.progressTrack}>
            <div
              id="quiz-progress-fill"
              className={styles.progressFill}
              style={{ width: total > 0 ? `${(1 / total) * 100}%` : "0%" }}
            />
          </div>
          <span id="quiz-count" className={styles.quizCount}>
            {t("count", { current: 1, total })}
          </span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyQuestions}>
            <p>{t("emptyQuestions")}</p>
          </div>
        ) : (
          localizedQuestions.map((q, i) => (
            <QuestionSlide
              key={q.id}
              question={q}
              index={i}
              topicId={topic.id}
              isSignsTopic={topic.slug === "signs"}
              letters={letters}
              bookmarked={bookmarkedIds.has(q.id)}
              t={t}
            />
          ))
        )}

        <div id="quiz-footer" className={styles.quizFooter}>
          <div id="reward-banner" className={styles.rewardBanner}>
            <span className={styles.rewardPill} aria-label={t("scoreLabel")}>
              <Icon name="star" size={12} />
              <span id="reward-score">0</span>
              <span id="reward-float" className={styles.rewardFloat} aria-hidden="true">+10</span>
            </span>
            <span id="reward-message" className={styles.rewardMsg} aria-live="polite"></span>
          </div>

          <button
            id="quiz-next"
            className={`btn-primary${total === 0 ? ` ${styles.hidden}` : ""}`}
            disabled
          >
            {t("nextBtn")}
          </button>

          <p
            id="quiz-auto-advance-hint"
            className={`${styles.hidden} ${styles.autoAdvanceHint}`}
          >
            {t("autoAdvanceHint")}
          </p>
        </div>

        <div id="quiz-final" className={`${styles.hidden} ${styles.quizFinal}`} tabIndex={-1}>
          <span className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} className={styles.confettiPiece} />
            ))}
          </span>
          <Icon name="trophy" size={48} className={styles.finalIcon} />
          <h2>{t("finalTitle")}</h2>
          <span className={styles.finalScore}>
            <span id="final-score"></span>
          </span>
          <span className={styles.rewardPill}>
            <Icon name="star" size={12} />
            <span className="sr-only">{t("scoreLabel")}</span>
            <span id="final-xp">0</span>
          </span>
          {nextTopic ? (
            <Link
              href={`/topics/${nextTopic.slug}`}
              id="quiz-next-topic"
              className={`pressable-card ${styles.nextTopicCard}`}
            >
              <span className={styles.nextTopicLabel}>{t("nextTopicLabel")}</span>
              <span className={styles.nextTopicName}>
                {localizedRecordField(locale, nextTopic as Record<string, unknown>, "name_he", "name_ar")}
              </span>
            </Link>
          ) : null}
          <a href={`/${locale}`} className={`btn-primary ${styles.btnWide}`}>
            {t("finalBackHome")}
          </a>
          <Link href={`/topics/${slug}/review`} className={`btn-secondary ${styles.btnWide}`}>
            {t("finalReview")}
          </Link>
        </div>
      </main>

      <Script src="/js/medal.js" strategy="afterInteractive" />
      <Script src="/js/quiz.js" strategy="afterInteractive" />
      <Script src="/js/bookmark.js" strategy="afterInteractive" />
    </>
  );
}

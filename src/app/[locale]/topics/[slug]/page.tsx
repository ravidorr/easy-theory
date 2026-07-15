import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { Icon } from "@/components/Icon";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic, getBookmarkedQuestionIds } from "@/lib/db";
import type { Question } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import { localizeQuestion } from "@/lib/content-locale";
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

function QuestionSlide({
  question,
  index,
  topicId,
  letters,
  bookmarked,
  t,
}: {
  question: Question;
  index: number;
  topicId: string;
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
        <h2>{questionText}</h2>
      </div>

      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text);
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

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const [questions, bookmarkedIds] = await Promise.all([
    getQuestionsForTopic(supabase, topic.id),
    getBookmarkedQuestionIds(supabase, user.id),
  ]);
  const total = questions.length;

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
        className={styles.page}
      >
        <div className={styles.topBar}>
          <Link href="/" className={styles.closeBtn} aria-label={t("closeLabel")}>
            ✕
          </Link>
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
            {t("answerBtn")}
          </button>
        </div>

        <div id="quiz-final" className={`${styles.hidden} ${styles.quizFinal}`}>
          <span className={styles.finalEmoji}>🎉</span>
          <h2>{t("finalTitle")}</h2>
          <span className={styles.finalScore}>
            <span id="final-score"></span>
          </span>
          <Link href="/" className={`btn-primary ${styles.btnWide}`}>
            {t("finalBackHome")}
          </Link>
          <Link href={`/topics/${slug}/review`} className={`btn-secondary ${styles.btnWide}`}>
            {t("finalReview")}
          </Link>
        </div>
      </main>

      <Script src="/js/quiz.js" strategy="afterInteractive" />
      <Script src="/js/bookmark.js" strategy="afterInteractive" />
    </>
  );
}

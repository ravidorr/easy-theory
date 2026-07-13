import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { Icon } from "@/components/Icon";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
import type { Question } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import styles from "../page.module.css";

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

function QuestionSlide({
  question,
  index,
  topicId,
  letters,
}: {
  question: Question;
  index: number;
  topicId: string;
  letters: string[];
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
        {imageUrl && (
          isWide ? (
            <div className={styles.imgWide}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className={styles.imgEl} />
            </div>
          ) : (
            <div className={styles.imgSquare}>
              <SignImage src={imageUrl!} size="md" />
            </div>
          )
        )}
        <h2>{questionText}</h2>
      </div>

      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text);
          return (
            <button key={key} className="quiz-option" data-option={key}>
              <span className="quiz-option-badge">{letters[i]}</span>
              {optionSignImg ? (
                <span className={styles.optionSignContent}>
                  <SignImage src={optionSignImg} size="md" />
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/topics/${slug}/retry`);

  const locale = await getLocale();
  const tQuiz = await getTranslations("Quiz");
  const tRetry = await getTranslations("Retry");

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const mistakes = await getMistakesForTopic(supabase, user.id, topic.id, "lastSession");
  if (mistakes.length === 0) redirect(`/topics/${slug}/review`);

  const total = mistakes.length;
  const questionField = locale === "ar" ? "question_ar" : "question_he";
  const explanationField = locale === "ar" ? "explanation_ar" : "explanation_he";
  const letters = tQuiz("letters").split(",");

  const localizedMistakes = mistakes.map((q) => {
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
    <>
      <main
        id="quiz-container"
        data-topic-id={topic.id}
        data-total={total}
        data-quiz-mode="retry"
        className={styles.page}
      >
        <div className={styles.topBar}>
          <Link href={`/topics/${slug}/review`} className={styles.closeBtn}>
            ✕
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
            letters={letters}
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
            {tQuiz("answerBtn")}
          </button>
        </div>

        <div id="quiz-final" className={`${styles.hidden} ${styles.quizFinal}`}>
          <span className={styles.finalEmoji}>🎯</span>
          <h2>{tRetry("finalTitle")}</h2>
          <span className={styles.finalScore}>
            <span id="final-score"></span>
          </span>
          <Link href={`/topics/${slug}/review`}>
            <button className={`btn-primary ${styles.btnWide}`}>{tRetry("finalBackReview")}</button>
          </Link>
          <Link href="/">
            <button className={`btn-secondary ${styles.btnWide}`}>{tRetry("finalBackHome")}</button>
          </Link>
        </div>
      </main>

      <Script src="/js/quiz.js" strategy="afterInteractive" />
    </>
  );
}

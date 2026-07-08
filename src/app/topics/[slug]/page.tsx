import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic } from "@/lib/db";
import type { Question } from "@/lib/db";
import styles from "./page.module.css";

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/questions/")) {
    if (!existsSync(join(process.cwd(), "public", url))) return null;
  }
  return url;
}

function resolveOptionSignImage(text: string): string | null {
  if (!/^\d{2,4}$/.test(text.trim())) return null;
  const path = join(process.cwd(), "public", "signs", `sign-${text.trim()}.png`);
  return existsSync(path) ? `/signs/sign-${text.trim()}.png` : null;
}

const LETTERS = ["א", "ב", "ג", "ד"];

function QuestionSlide({
  question,
  index,
  total,
  topicId,
}: {
  question: Question;
  index: number;
  total: number;
  topicId: string;
}) {
  const options: [string, string][] = [
    ["a", question.option_a],
    ["b", question.option_b],
    ["c", question.option_c],
    ["d", question.option_d],
  ];

  const allOptionsAreSigns = options.every(([, text]) => /^\d{2,4}$/.test(text.trim()));
  const imageUrl = allOptionsAreSigns ? null : resolveImageUrl(question.image_url);
  const isWide = imageUrl && !imageUrl.includes("sign-");

  return (
    <div
      className={`quiz-slide ${styles.slideItem}`}
      data-index={index}
      data-question-id={question.id}
      data-topic-id={topicId}
      data-correct={question.correct_option}
      style={{ display: index === 0 ? "flex" : "none" }}
    >
      {/* Question + image */}
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
        <h2>{question.question_he}</h2>
      </div>

      {/* Options */}
      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text);
          return (
            <button
              key={key}
              className="quiz-option"
              data-option={key}
            >
              <span className="quiz-option-badge">{LETTERS[i]}</span>
              {optionSignImg ? (
                <span className={styles.optionSignContent}>
                  <SignImage src={optionSignImg} size="sm" />
                </span>
              ) : (
                <span className={styles.optionTextContent}>{text}</span>
              )}
              {question.explanation_he && (
                <span className="quiz-option-explanation">
                  {question.explanation_he}
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const questions = await getQuestionsForTopic(supabase, topic.id);
  const total = questions.length;

  return (
    <>
      <main
        id="quiz-container"
        data-topic-id={topic.id}
        data-total={total}
        className={styles.page}
      >
        {/* Top bar */}
        <div className={styles.topBar}>
          <Link href="/" className={styles.closeBtn}>
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
            1 מתוך {total}
          </span>
        </div>

        {/* Questions */}
        {total === 0 ? (
          <div className={styles.emptyQuestions}>
            <p>אין שאלות זמינות לנושא זה עדיין.</p>
          </div>
        ) : (
          questions.map((q, i) => (
            <QuestionSlide
              key={q.id}
              question={q}
              index={i}
              total={total}
              topicId={topic.id}
            />
          ))
        )}

        {/* Footer */}
        <div id="quiz-footer" className={styles.quizFooter}>
          <div id="reward-banner" hidden className={styles.rewardBanner}>
            <span className={styles.rewardPill}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z" />
              </svg>
              <span id="reward-amount">+10</span>
            </span>
            <span id="reward-message" className={styles.rewardMsg}>יפה מאוד!</span>
          </div>

          <button
            id="quiz-next"
            className="btn-primary"
            disabled
            style={{ display: total === 0 ? "none" : undefined }}
          >
            בדקי תשובה
          </button>
        </div>

        {/* Final screen — hidden until quiz ends */}
        <div
          id="quiz-final"
          className={`${styles.hidden} ${styles.quizFinal}`}
        >
          <span className={styles.finalEmoji}>🎉</span>
          <h2>סיימת!</h2>
          <span className={styles.finalScore}>
            <span id="final-score"></span>
          </span>
          <Link href="/">
            <button className={`btn-primary ${styles.btnWide}`}>חזרה לבית</button>
          </Link>
          <Link href={`/topics/${slug}/review`}>
            <button className={`btn-secondary ${styles.btnWide}`}>סקירת טעויות</button>
          </Link>
        </div>
      </main>

      <Script src="/js/quiz.js" strategy="afterInteractive" />
    </>
  );
}

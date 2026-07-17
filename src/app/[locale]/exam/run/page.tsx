import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getRandomExamQuestions } from "@/lib/db";
import type { Question } from "@/lib/db";
import {
  EXAM_QUESTION_COUNT,
  EXAM_DURATION_SECONDS,
  EXAM_PASS_MARK,
} from "@/lib/exam";
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

// Exam slide — unlike the practice quiz, the correct option and explanation are
// deliberately NOT rendered; scoring happens server-side at submit.
function ExamSlide({
  question,
  index,
  letters,
  t,
}: {
  question: Question;
  index: number;
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

  return (
    <div
      className={`quiz-slide ${styles.slideItem}`}
      data-index={index}
      data-question-id={question.id}
      style={{ display: index === 0 ? "flex" : "none" }}
    >
      <div className={styles.questionContainer}>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default async function ExamRunPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/exam/run");

  const locale = await getLocale();
  const t = await getTranslations("Exam");
  const tQuiz = await getTranslations("Quiz");

  const questions = await getRandomExamQuestions(supabase, EXAM_QUESTION_COUNT);
  const total = questions.length;

  const letters = t("letters").split(",");

  const localizedQuestions = questions.map((q) => ({
    ...q,
    ...localizeQuestion(locale, q as Record<string, unknown>),
  }));

  return (
    <>
      <main
        id="exam-container"
        data-total={total}
        data-duration-seconds={EXAM_DURATION_SECONDS}
        data-pass-mark={EXAM_PASS_MARK}
        className={styles.page}
      >
        <div className={styles.topBar}>
          <Link href="/exam" className={`icon-btn ${styles.closeBtn}`} aria-label={t("closeLabel")}>
            ✕
          </Link>
          <div className={styles.progressTrack}>
            <div
              id="exam-progress-fill"
              className={styles.progressFill}
              style={{ width: total > 0 ? `${(1 / total) * 100}%` : "0%" }}
            />
          </div>
          <span
            id="exam-timer"
            className={styles.timer}
            aria-label={t("timerLabel")}
          >
            {formatDuration(EXAM_DURATION_SECONDS)}
          </span>
          <span id="exam-count" className={styles.quizCount}>
            {t("count", { current: 1, total })}
          </span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyQuestions}>
            <p>{t("emptyQuestions")}</p>
          </div>
        ) : (
          localizedQuestions.map((q, i) => (
            <ExamSlide key={q.id} question={q} index={i} letters={letters} t={tQuiz} />
          ))
        )}

        <div id="exam-footer" className={styles.examFooter}>
          <div id="exam-error" className={styles.examError} aria-live="polite" hidden></div>
          <span id="exam-answered" className={styles.answeredCount} aria-live="polite">
            {t("answered", { answered: 0, total })}
          </span>
          <div className={styles.navButtons}>
            <button id="exam-prev" className={`btn-secondary ${styles.navBtn}`} disabled>
              {t("prevBtn")}
            </button>
            <button id="exam-next" className={`btn-primary ${styles.navBtn}`}>
              {t("nextBtn")}
            </button>
          </div>
          <button
            id="exam-submit"
            className={`btn-primary ${total === 0 ? "" : styles.hidden}`}
            disabled={total === 0}
          >
            {t("submitBtn")}
          </button>
        </div>

        <div id="exam-result" className={`${styles.hidden} ${styles.examFinal}`}>
          <h2 id="exam-result-title"></h2>
          <span id="exam-result-score" className={styles.finalScore}></span>
          <button id="exam-review-btn" className={`btn-secondary ${styles.btnWide}`}>
            {t("reviewBtn")}
          </button>
          <Link href="/exam" className={`btn-primary ${styles.btnWide}`}>
            {t("backToExam")}
          </Link>
        </div>
      </main>

      <Script src="/js/exam.js" strategy="afterInteractive" />
    </>
  );
}

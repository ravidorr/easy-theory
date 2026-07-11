import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
import type { QuizMistake } from "@/lib/db";
import styles from "./page.module.css";

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/questions/")) {
    if (!existsSync(join(process.cwd(), "public", url))) return "__placeholder__";
  }
  return url;
}

function resolveOptionSignImage(text: string): string | null {
  if (!/^\d{2,4}$/.test(text.trim())) return null;
  const path = join(process.cwd(), "public", "signs", `sign-${text.trim()}.png`);
  return existsSync(path) ? `/signs/sign-${text.trim()}.png` : null;
}

const LETTERS = ["א", "ב", "ג", "ד"];

function QuestionReview({ question }: { question: QuizMistake }) {
  const options: [string, string][] = [
    ["a", question.option_a],
    ["b", question.option_b],
    ["c", question.option_c],
    ["d", question.option_d],
  ];

  const isSignQuestion =
    question.image_url?.includes("/signs/") &&
    options.some(([, text]) => /^\d{2,4}$/.test(text.trim()));
  const imageUrl = isSignQuestion ? null : resolveImageUrl(question.image_url);
  const isWide = imageUrl && imageUrl !== "__placeholder__" && !imageUrl.includes("sign-");

  return (
    <div className={styles.questionCard}>
      {imageUrl && imageUrl !== "__placeholder__" && (
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

      <h3>{question.question_he}</h3>

      <div className={styles.optionsList}>
        {options.map(([key, text], i) => {
          const optionSignImg = resolveOptionSignImage(text);
          const state =
            key === question.correct_option
              ? "correct"
              : key === question.selected_option
              ? "wrong"
              : undefined;

          return (
            <div
              key={key}
              className={`quiz-option ${styles.optionStatic}`}
              data-state={state}
            >
              <span className="quiz-option-badge">{LETTERS[i]}</span>
              {optionSignImg ? (
                <span className={styles.optionSignContent}>
                  <SignImage src={optionSignImg} size="md" />
                  <span className={styles.optionSignLabel}>{text}</span>
                </span>
              ) : (
                <span className={styles.optionTextContent}>{text}</span>
              )}
              {state === "correct" && question.explanation_he && (
                <span className="quiz-option-explanation">
                  {question.explanation_he}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/topics/${slug}/review`);

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const mistakes = await getMistakesForTopic(supabase, user.id, topic.id);

  return (
    <main className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <Link href={`/topics/${slug}`} className={styles.closeBtn}>
          ✕
        </Link>
        <h1>סקירת טעויות</h1>
      </div>

      {mistakes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>🎉</span>
          <p className={styles.emptyHint}>אין טעויות! עשית הכל נכון</p>
          <Link href="/">
            <button className={`btn-primary ${styles.btnWide}`}>חזרה לבית</button>
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.mistakeCount}>
            {mistakes.length === 1 ? "שאלה אחת שגית" : `${mistakes.length} שאלות שגית`}
          </p>
          {mistakes.map((mistake) => (
            <QuestionReview key={mistake.id} question={mistake} />
          ))}
          <Link href="/" className={styles.returnLink}>
            <button className={`btn-primary ${styles.btnFull}`}>חזרה לבית</button>
          </Link>
        </>
      )}
    </main>
  );
}

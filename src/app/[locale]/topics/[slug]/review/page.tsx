import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
import type { QuizMistake } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import styles from "@/app/topics/[slug]/review/page.module.css";

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

function QuestionReview({
  question,
  letters,
}: {
  question: QuizMistake;
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
    <div className={styles.questionCard}>
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

      <h3>{questionText}</h3>

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
                <span className="quiz-option-explanation">{explanationText}</span>
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

  const locale = await getLocale();
  const t = await getTranslations("Review");
  const tQuiz = await getTranslations("Quiz");

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const mistakes = await getMistakesForTopic(supabase, user.id, topic.id);

  const questionField = locale === "ar" ? "question_ar" : "question_he";
  const explanationField = locale === "ar" ? "explanation_ar" : "explanation_he";
  const letters = tQuiz("letters").split(",");

  const localizedMistakes = mistakes.map((q) => {
    const qAny = q as Record<string, unknown>;
    return {
      ...q,
      question_display: qAny[questionField] as string ?? q.question_he,
      explanation_display: qAny[explanationField] as string ?? q.explanation_he,
      option_a_display: (qAny.option_a_ar as string) ?? q.option_a,
      option_b_display: (qAny.option_b_ar as string) ?? q.option_b,
      option_c_display: (qAny.option_c_ar as string) ?? q.option_c,
      option_d_display: (qAny.option_d_ar as string) ?? q.option_d,
    };
  });

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href={`/topics/${slug}`} className={styles.closeBtn}>
          ✕
        </Link>
        <h1>{t("topBarTitle")}</h1>
      </div>

      {localizedMistakes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>🎉</span>
          <p className={styles.emptyHint}>{t("emptyHint")}</p>
          <Link href="/">
            <button className={`btn-primary ${styles.btnWide}`}>{t("backHome")}</button>
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.mistakeCount}>
            {localizedMistakes.length === 1
              ? t("mistakeCountOne")
              : t("mistakeCountMany", { count: localizedMistakes.length })}
          </p>
          <Link href={`/topics/${slug}/retry`}>
            <button className={`btn-primary ${styles.btnFull}`}>{t("retryBtn")}</button>
          </Link>
          {localizedMistakes.map((mistake) => (
            <QuestionReview key={mistake.id} question={mistake} letters={letters} />
          ))}
          <Link href="/" className={styles.returnLink}>
            <button className={`btn-primary ${styles.btnFull}`}>{t("backHome")}</button>
          </Link>
        </>
      )}
    </main>
  );
}

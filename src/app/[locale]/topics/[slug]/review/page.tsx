import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
import type { MistakeScope, QuizMistake } from "@/lib/db";
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

function QuestionReview({
  question,
  letters,
  t,
}: {
  question: QuizMistake;
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
      {imageUrl && (
        isWide ? (
          <div className={styles.imgWide}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={t("questionImageAlt")} className={styles.imgEl} />
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
                <span className="quiz-option-explanation">
                  <InlineMarkdown>{explanationText}</InlineMarkdown>
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { slug } = await params;
  const { scope: scopeParam } = await searchParams;
  const scope: MistakeScope = scopeParam === "all" ? "all" : "lastSession";
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

  const mistakes = await getMistakesForTopic(supabase, user.id, topic.id, scope);

  // Retry always practices the LAST session's mistakes — hide the button when that
  // session is clean so it can't bounce straight back to an empty review.
  let showRetry: boolean;
  let hasOlderMistakes = false;
  if (scope === "lastSession") {
    showRetry = mistakes.length > 0;
    if (!showRetry) {
      hasOlderMistakes =
        (await getMistakesForTopic(supabase, user.id, topic.id, "all")).length > 0;
    }
  } else {
    showRetry =
      mistakes.length > 0 &&
      (await getMistakesForTopic(supabase, user.id, topic.id, "lastSession")).length > 0;
  }

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
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href={`/topics/${slug}`} className={styles.closeBtn} aria-label={tQuiz("closeLabel")}>
          ✕
        </Link>
        <h1>{t("topBarTitle")}</h1>
      </div>

      <div className={styles.scopeToggle} role="group" aria-label={t("scopeLabel")}>
        <Link
          href={`/topics/${slug}/review`}
          className={styles.scopeOption}
          data-active={scope === "lastSession" || undefined}
          aria-current={scope === "lastSession" ? "page" : undefined}
        >
          {t("scopeLastSession")}
        </Link>
        <Link
          href={`/topics/${slug}/review?scope=all`}
          className={styles.scopeOption}
          data-active={scope === "all" || undefined}
          aria-current={scope === "all" ? "page" : undefined}
        >
          {t("scopeAllTime")}
        </Link>
      </div>

      {localizedMistakes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmoji}>🎉</span>
          <p className={styles.emptyHint}>
            {hasOlderMistakes ? t("emptyHintLastSession") : t("emptyHint")}
          </p>
          {hasOlderMistakes && (
            <Link href={`/topics/${slug}/review?scope=all`} className={`btn-secondary ${styles.btnWide}`}>
              {t("viewAllMistakes")}
            </Link>
          )}
          <Link href="/" className={`btn-primary ${styles.btnWide}`}>
            {t("backHome")}
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.mistakeCount}>
            {localizedMistakes.length === 1
              ? t("mistakeCountOne")
              : t("mistakeCountMany", { count: localizedMistakes.length })}
          </p>
          {showRetry && (
            <Link href={`/topics/${slug}/retry`} className={`btn-primary ${styles.btnFull}`}>
              {t("retryBtn")}
            </Link>
          )}
          {localizedMistakes.map((mistake) => (
            <QuestionReview key={mistake.id} question={mistake} letters={letters} t={tQuiz} />
          ))}
          <Link href="/" className={`btn-primary ${styles.btnFull} ${styles.returnLink}`}>
            {t("backHome")}
          </Link>
        </>
      )}
    </main>
  );
}

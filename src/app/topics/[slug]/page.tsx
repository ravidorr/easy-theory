import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { existsSync } from "fs";
import { join } from "path";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getQuestionsForTopic } from "@/lib/db";
import type { Question } from "@/lib/db";

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

  const imageUrl = resolveImageUrl(question.image_url);
  const isWide = imageUrl && imageUrl !== "__placeholder__" && !imageUrl.includes("sign-");

  return (
    <div
      className="quiz-slide"
      data-index={index}
      data-question-id={question.id}
      data-topic-id={topicId}
      data-correct={question.correct_option}
      style={{ display: index === 0 ? "flex" : "none", flexDirection: "column", gap: "20px" }}
    >
      {/* Question + image */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "center",
        }}
      >
        {imageUrl && imageUrl !== "__placeholder__" && (
          isWide ? (
            /* Wide road-scene image */
            <div
              style={{
                width: "100%",
                borderRadius: "var(--radius-xl)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-card)",
                overflow: "hidden",
                aspectRatio: "16/9",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            /* Square sign image */
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "var(--radius-xl)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl!}
                alt=""
                style={{ width: "96px", height: "96px", objectFit: "contain" }}
              />
            </div>
          )
        )}
        <h2
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            lineHeight: "var(--line-tight)",
            color: "var(--text)",
            textAlign: "center",
          }}
        >
          {question.question_he}
        </h2>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                /* Sign-number option: show image + number */
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optionSignImg}
                    alt=""
                    style={{ width: "52px", height: "52px", objectFit: "contain", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
                    {text}
                  </span>
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "var(--type-body-size)",
                    lineHeight: "var(--line-body)",
                    color: "var(--text)",
                    flex: 1,
                  }}
                >
                  {text}
                </span>
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

  // Fetch extra to account for filtering out questions with missing images
  const raw = await getQuestionsForTopic(supabase, topic.id, 20);
  const questions = raw.filter(q => resolveImageUrl(q.image_url) !== "__placeholder__");
  const total = questions.length;

  return (
    <>
      <main
        id="quiz-container"
        data-topic-id={topic.id}
        data-total={total}
        style={{
          background: "var(--bg)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "440px",
          margin: "0 auto",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              fontSize: "18px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              textDecoration: "none",
            }}
          >
            ✕
          </Link>
          <div
            style={{
              flex: 1,
              height: "8px",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              id="quiz-progress-fill"
              style={{
                width: total > 0 ? `${(1 / total) * 100}%` : "0%",
                height: "100%",
                borderRadius: "var(--radius-pill)",
                background: "var(--primary)",
                transition: "width 300ms ease",
              }}
            />
          </div>
          <span
            id="quiz-count"
            style={{
              fontSize: "var(--type-caption-size)",
              fontWeight: "var(--type-caption-weight)" as never,
              color: "var(--text-faint)",
              flexShrink: 0,
            }}
          >
            1 מתוך {total}
          </span>
        </div>

        {/* Questions */}
        {total === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
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
        <div
          id="quiz-footer"
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div id="reward-banner" hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--gold-soft)",
                color: "var(--gold-text)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 9px",
                fontWeight: 700,
                fontSize: "12.5px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1.2l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.2.9-4.6L1.4 6l4.6-.6z" />
              </svg>
              <span id="reward-amount">+10</span>
            </span>
            <span id="reward-message" style={{ fontSize: "var(--type-small-size)", color: "var(--text-muted)" }}>
              יפה מאוד!
            </span>
          </div>

          <button
            id="quiz-next"
            className="btn-primary"
            disabled
            style={{ display: total === 0 ? "none" : undefined }}
          >
            לשאלה הבאה
          </button>
        </div>

        {/* Final screen — hidden until quiz ends */}
        <div
          id="quiz-final"
          style={{
            display: "none",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            textAlign: "center",
            padding: "40px 0",
          }}
        >
          <span style={{ fontSize: "48px" }}>🎉</span>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--type-h1-size)",
              fontWeight: "var(--type-h1-weight)" as never,
              color: "var(--text)",
            }}
          >
            סיימת!
          </h2>
          <span style={{ fontSize: "var(--type-body-size)", color: "var(--text-muted)" }}>
            <span id="final-score"></span>
          </span>
          <Link href="/">
            <button className="btn-primary" style={{ minWidth: "200px" }}>חזרה לבית</button>
          </Link>
          <Link href={`/topics/${slug}/review`}>
            <button className="btn-secondary" style={{ minWidth: "200px" }}>סקירת טעויות</button>
          </Link>
        </div>
      </main>

      <Script src="/js/quiz.js" strategy="afterInteractive" />
    </>
  );
}

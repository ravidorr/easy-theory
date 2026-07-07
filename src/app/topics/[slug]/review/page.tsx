import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import { join } from "path";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getTopicBySlug, getMistakesForTopic } from "@/lib/db";
import type { QuizMistake } from "@/lib/db";

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

  const imageUrl = resolveImageUrl(question.image_url);
  const isWide = imageUrl && imageUrl !== "__placeholder__" && !imageUrl.includes("sign-");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {imageUrl && imageUrl !== "__placeholder__" && (
        isWide ? (
          <div
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
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
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
            }}
          >
            <SignImage src={imageUrl!} size="md" style={{ width: "88px", height: "88px" }} />
          </div>
        )
      )}

      <h3
        style={{
          margin: 0,
          fontSize: "var(--type-body-size)",
          fontWeight: "var(--type-h2-weight)" as never,
          lineHeight: "var(--line-body)",
          color: "var(--text)",
          textAlign: "center",
        }}
      >
        {question.question_he}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
              className="quiz-option"
              data-state={state}
              style={{ cursor: "default" }}
            >
              <span className="quiz-option-badge">{LETTERS[i]}</span>
              {optionSignImg ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                  <SignImage src={optionSignImg} size="sm" />
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
  if (!user) redirect("/auth/login");

  const topic = await getTopicBySlug(supabase, slug);
  if (!topic) notFound();

  const mistakes = await getMistakesForTopic(supabase, user.id, topic.id);

  return (
    <main
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
          href={`/topics/${slug}`}
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
        <h1
          style={{
            margin: 0,
            fontSize: "var(--type-h2-size)",
            fontWeight: "var(--type-h2-weight)" as never,
            color: "var(--text)",
          }}
        >
          סקירת טעויות
        </h1>
      </div>

      {mistakes.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            padding: "60px 0",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "48px" }}>🎉</span>
          <p
            style={{
              margin: 0,
              fontSize: "var(--type-body-size)",
              color: "var(--text-muted)",
            }}
          >
            אין טעויות! עשית הכל נכון
          </p>
          <Link href="/">
            <button className="btn-primary" style={{ minWidth: "180px" }}>
              חזרה לבית
            </button>
          </Link>
        </div>
      ) : (
        <>
          <p
            style={{
              margin: 0,
              fontSize: "var(--type-small-size)",
              color: "var(--text-muted)",
            }}
          >
            {mistakes.length === 1 ? "שאלה אחת שגית" : `${mistakes.length} שאלות שגית`}
          </p>
          {mistakes.map((mistake) => (
            <QuestionReview key={mistake.id} question={mistake} />
          ))}
          <Link href="/" style={{ marginTop: "8px" }}>
            <button className="btn-primary" style={{ width: "100%" }}>
              חזרה לבית
            </button>
          </Link>
        </>
      )}
    </main>
  );
}

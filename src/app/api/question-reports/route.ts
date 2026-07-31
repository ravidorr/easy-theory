import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient, createClient } from "@/lib/supabase";
import { getApiTranslator, parseJsonBody } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isLocale(value: unknown): value is "he" | "ar" {
  return value === "he" || value === "ar";
}

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: t("questionReportInvalid") }, { status: 400 });

  const { question_id: questionId, topic_id: topicId, locale, comment, category } = body;
  const normalizedComment = typeof comment === "string" ? comment.trim() : null;
  const reportCategory = typeof category === "string" && ["unclear", "wrong_answer", "outdated", "image", "wording"].includes(category)
    ? category
    : "unclear";
  if (
    !isUuid(questionId) ||
    !isUuid(topicId) ||
    !isLocale(locale) ||
    (comment !== undefined && (typeof comment !== "string" || !normalizedComment || normalizedComment.length > 1000))
  ) {
    return NextResponse.json({ error: t("questionReportInvalid") }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const admin = createAdminClient();
  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("topic_id, source_release_id")
    .eq("id", questionId)
    .maybeSingle();
  if (questionError) {
    reportError("question-reports", "question lookup failed", questionError, { userId: user.id, questionId });
    return NextResponse.json({ error: t("questionReportSaveFailed") }, { status: 500 });
  }
  if (!question || question.topic_id !== topicId) {
    return NextResponse.json({ error: t("questionReportInvalid") }, { status: 400 });
  }

  const { data: topic, error: topicError } = await admin
    .from("topics")
    .select("id, slug")
    .eq("id", topicId)
    .maybeSingle();
  if (topicError) {
    reportError("question-reports", "topic lookup failed", topicError, { userId: user.id, topicId });
    return NextResponse.json({ error: t("questionReportSaveFailed") }, { status: 500 });
  }
  if (!topic) return NextResponse.json({ error: t("questionReportInvalid") }, { status: 400 });

  const { data: existing, error: existingError } = await admin
    .from("question_reports")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();
  if (existingError) {
    reportError("question-reports", "existing report lookup failed", existingError, { userId: user.id, questionId });
    return NextResponse.json({ error: t("questionReportSaveFailed") }, { status: 500 });
  }
  if (existing) return NextResponse.json({ ok: true });

  const allowed = await checkRateLimit(supabase, `question-reports:${user.id}`, 5, 3600);
  if (!allowed) return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });

  let sourceRelease: { source_checksum: string } | null = null;
  if (question.source_release_id) try {
    const { data } = await admin
      .from("content_source_releases")
      .select("source_checksum")
      .eq("id", question.source_release_id)
      .maybeSingle();
    sourceRelease = data;
  } catch (sourceError) {
    // Reporting must remain available if a pre-migration environment has not
    // received source-release metadata yet.
    reportError("question-reports", "source release lookup failed", sourceError, { userId: user.id });
  }

  const { data: report, error: insertError } = await admin
    .from("question_reports")
    .insert({
      user_id: user.id,
      question_id: questionId,
      comment: normalizedComment,
      locale,
      category: reportCategory,
      source_checksum: sourceRelease?.source_checksum ?? null,
    })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") return NextResponse.json({ ok: true });
    reportError("question-reports", "report insert failed", insertError, { userId: user.id, questionId });
    return NextResponse.json({ error: t("questionReportSaveFailed") }, { status: 500 });
  }

  const recipient = process.env.CONTACT_NOTIFICATION_EMAIL;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!recipient || !sender) {
    reportError(
      "question-reports",
      "notification email is not configured",
      new Error("missing recipient or sender"),
      { userId: user.id, reportId: report.id }
    );
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: notificationError } = await resend.emails.send({
        from: sender,
        to: recipient,
        subject: `Easy Theory question report: ${topic.slug}`,
        text: [
          `Report ID: ${report.id}`,
          `User ID: ${user.id}`,
          `Question ID: ${questionId}`,
          `Topic ID: ${topic.id}`,
          `Topic slug: ${topic.slug}`,
          `Locale: ${locale}`,
          `Category: ${reportCategory}`,
          `Source checksum: ${sourceRelease?.source_checksum ?? "unknown"}`,
          `Comment: ${normalizedComment ?? "not provided"}`,
        ].join("\n"),
      });
      if (notificationError) throw notificationError;
    } catch (notificationError) {
      reportError("question-reports", "notification send failed", notificationError, {
        userId: user.id,
        reportId: report.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

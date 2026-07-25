import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient, createClient } from "@/lib/supabase";
import { getApiTranslator, getRequestLocale, parseJsonBody } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

const TOPICS = ["question", "bug", "idea", "general"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isTopic(value: unknown): value is (typeof TOPICS)[number] {
  return typeof value === "string" && TOPICS.includes(value as (typeof TOPICS)[number]);
}

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: t("contactInvalid") }, { status: 400 });

  const { topic, message, reply_email: replyEmail } = body;
  const normalizedMessage = typeof message === "string" ? message.trim() : "";
  const normalizedEmail = typeof replyEmail === "string" ? replyEmail.trim().toLowerCase() : "";
  if (
    !isTopic(topic) ||
    normalizedMessage.length === 0 ||
    normalizedMessage.length > 2000 ||
    (normalizedEmail !== "" && (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)))
  ) {
    return NextResponse.json({ error: t("contactInvalid") }, { status: 400 });
  }

  const recipient = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (!recipient) {
    reportError("contact", "CONTACT_NOTIFICATION_EMAIL is not configured", new Error("missing recipient"));
    return NextResponse.json({ error: t("contactSendFailed") }, { status: 500 });
  }
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!sender) {
    reportError("contact", "RESEND_FROM_EMAIL is not configured", new Error("missing sender"));
    return NextResponse.json({ error: t("contactSendFailed") }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `contact:${user.id}`, 5, 3600);
  if (!allowed) return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });

  const locale = getRequestLocale(request);
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("contact_messages").insert({
    user_id: user.id,
    topic,
    message: normalizedMessage,
    reply_email: normalizedEmail || null,
    locale,
  });
  if (insertError) {
    reportError("contact", "message insert failed", insertError, { userId: user.id });
    return NextResponse.json({ error: t("contactSendFailed") }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: notificationError } = await resend.emails.send({
      from: sender,
      to: recipient,
      ...(normalizedEmail ? { replyTo: normalizedEmail } : {}),
      subject: `New Easy Theory contact message: ${topic}`,
      text: [
        `Topic: ${topic}`,
        `User ID: ${user.id}`,
        `Locale: ${locale}`,
        `Reply email: ${normalizedEmail || "not provided"}`,
        "",
        normalizedMessage,
      ].join("\n"),
    });
    if (notificationError) throw notificationError;
  } catch (notificationError) {
    // The message is already stored and available to support, so an email
    // delivery problem must not make the user submit a duplicate message.
    reportError("contact", "notification send failed", notificationError, { userId: user.id });
  }

  return NextResponse.json({ ok: true });
}

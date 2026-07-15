import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("emailMissing") }, { status: 400 });
  }
  const { email, next } = body;
  const requestUrl = new URL(request.url);
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";
  const callbackOrigin =
    process.env.AUTH_CALLBACK_ORIGIN?.replace(/\/$/, "") || requestUrl.origin;
  const emailRedirectTo = `${callbackOrigin}/auth/callback`;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: t("emailMissing") }, { status: 400 });
  }
  const trimmedEmail = email.trim().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: t("emailInvalid") }, { status: 400 });
  }

  const supabase = await createClient();

  const allowed = await checkRateLimit(supabase, `otp:${trimmedEmail.toLowerCase()}`, 3, 900);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyOtpAttempts") }, { status: 429 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail.toLowerCase(),
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    console.error("[send-otp] signInWithOtp failed:", error.message);
    return NextResponse.json({ error: t("otpSendFailed") }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_redirect", safeNext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

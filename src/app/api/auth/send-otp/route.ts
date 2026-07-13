import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "כתובת מייל חסרה" }, { status: 400 });
  }
  const { email, next } = body;
  const requestUrl = new URL(request.url);
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";
  const emailRedirectTo = `${requestUrl.origin}/auth/callback`;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "כתובת מייל חסרה" }, { status: 400 });
  }
  const trimmedEmail = email.trim().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: "כתובת המייל אינה תקינה" }, { status: 400 });
  }

  const supabase = await createClient();

  const allowed = await checkRateLimit(supabase, `otp:${trimmedEmail.toLowerCase()}`, 3, 900);
  if (!allowed) {
    return NextResponse.json({ error: "יותר מדי ניסיונות, נסי שוב בעוד 15 דקות" }, { status: 429 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail.toLowerCase(),
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    return NextResponse.json({ error: "שגיאה בשליחת הקישור, נסי שוב" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_redirect", safeNext, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "כתובת מייל חסרה" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "כתובת המייל אינה תקינה" }, { status: 400 });
  }

  const supabase = await createClient();

  const allowed = await checkRateLimit(supabase, `otp:${email.trim().toLowerCase()}`, 3, 900);
  if (!allowed) {
    return NextResponse.json({ error: "יותר מדי ניסיונות, נסי שוב בעוד 15 דקות" }, { status: 429 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: "שגיאה בשליחת הקישור, נסי שוב" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `push:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = (await parseJsonBody(request)) as {
    endpoint?: string;
    keys?: { auth?: string; p256dh?: string };
  } | null;
  const endpoint = body?.endpoint;
  const auth = body?.keys?.auth;
  const p256dh = body?.keys?.p256dh;

  if (!endpoint || !auth || !p256dh) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }

  const { error } = await supabase.from("user_push_subscriptions").upsert(
    { user_id: user.id, endpoint, auth, p256dh },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("[push] subscription upsert failed:", error);
    return NextResponse.json({ error: t("pushSubscribeFailed") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `push:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const { error } = await supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[push] subscription delete failed:", error);
    return NextResponse.json({ error: t("pushUnsubscribeFailed") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

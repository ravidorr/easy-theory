import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const endpoint: string = body?.endpoint;
  const auth: string = body?.keys?.auth;
  const p256dh: string = body?.keys?.p256dh;

  if (!endpoint || !auth || !p256dh) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("user_push_subscriptions").upsert(
    { user_id: user.id, endpoint, auth, p256dh },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

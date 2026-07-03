import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", request.url));
}

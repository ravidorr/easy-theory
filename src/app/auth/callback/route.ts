import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const cookieStore = await cookies();

  const nextRaw =
    searchParams.get("next") ?? cookieStore.get("auth_redirect")?.value ?? "/";
  const safeNext = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  function successRedirect() {
    const response = NextResponse.redirect(`${origin}${safeNext}`);
    response.cookies.delete("auth_redirect");
    return response;
  }

  // Token-hash flow (cross-device, no PKCE cookie required)
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return successRedirect();
    }
  }

  // PKCE code flow (fallback for any in-flight PKCE links)
  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return successRedirect();
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=1`);
}

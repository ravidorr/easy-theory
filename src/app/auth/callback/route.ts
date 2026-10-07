import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { trackServerEvent } from "@/lib/pendo-server";

// Requesting a magic link is what creates an account, and links expire within
// an hour, so an account younger than that is completing its first sign-in.
const NEW_USER_WINDOW_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const cookieStore = await cookies();

  const nextRaw =
    searchParams.get("next") ?? cookieStore.get("auth_redirect")?.value ?? "/schedule";
  const safeNext = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/schedule";

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

  function trackSignIn(
    user: User | null,
    properties: { auth_flow: "token_hash" | "pkce"; otp_type?: EmailOtpType }
  ) {
    if (!user) return;
    after(() =>
      trackServerEvent("user_signed_in", user.id, {
        ...properties,
        next_path: safeNext,
        is_new_user: Date.now() - Date.parse(user.created_at) < NEW_USER_WINDOW_MS,
      })
    );
  }

  // Token-hash flow (cross-device, no PKCE cookie required)
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      trackSignIn(data.user, { auth_flow: "token_hash", otp_type: type });
      return successRedirect();
    }
  }

  // PKCE code flow (fallback for any in-flight PKCE links)
  const code = searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      trackSignIn(data.user, { auth_flow: "pkce" });
      return successRedirect();
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=1`);
}

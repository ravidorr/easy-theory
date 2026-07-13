import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createNextIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createNextIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals, static files, API routes, and the locale-less auth
  // callback (letting next-intl redirect it to /<locale>/auth/callback would 404 —
  // the route only exists outside the [locale] segment). Its error redirect to
  // /auth/login must still go through next-intl to gain a locale prefix.
  const skip = /^\/(_next|api|_vercel|auth\/callback|signs|js|questions|favicon\.ico|apple-icon|icon\.svg|manifest\.webmanifest|sw\.js)/.test(pathname)
    || pathname.includes(".");
  if (skip) return NextResponse.next();

  // 1. next-intl: detect locale and redirect/normalise URL if needed
  const intlRes = intlMiddleware(request);
  // If next-intl is redirecting (e.g. / → /he/), propagate that immediately
  if (intlRes.status !== 200) {
    return intlRes;
  }

  // 2. Supabase session refresh — use intlRes as the base response so that
  //    next-intl's forwarded request headers (x-next-intl-locale, etc.) are
  //    preserved for server components. Supabase cookies are added on top.
  const supabaseResponse = intlRes;
  let user = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            // Keep using intlRes as base — just set cookies on it
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable (missing credentials in dev) — treat as unauthenticated
  }

  // 3. Auth guard — derive locale from the (already-normalised) pathname
  const localeMatch = pathname.match(/^\/(he|ar)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  const isPublic =
    pathname.startsWith(`/${locale}/auth`) ||
    pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth/login`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

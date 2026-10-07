import { Rubik } from "next/font/google";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { detectLocale } from "@/i18n/detect-locale";
import { routing } from "@/i18n/routing";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

// Keep initialize in the snippet's script: the snippet is what creates the
// `pendo` queue stub, so initialize has to run right after it in the same script.
//
// The SDK persists identity and, on initialize, reads a persisted identified
// visitor back as the current one even when `visitor.id` is empty. With no
// Supabase session cookie nobody is signed in, so `forceAnonymous` makes
// initialize ignore a leftover identified id instead of attributing the page to
// the previous learner. A stale cookie (expired session) is handled by
// PendoIdentify once the server has checked it.
function pendoInstallScript(signedOut: boolean) {
  const options = signedOut
    ? "{ visitor: { id: '' }, forceAnonymous: true }"
    : "{ visitor: { id: '' } }";
  return `
(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track', 'trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('1074b64c-ee2f-4f65-a898-24f4bf352035');
pendo.initialize(${options});
`;
}

// Supabase stores the session in `sb-<project>-auth-token` (chunked as `.0`, `.1`).
function hasSupabaseSession(cookieNames: string[]) {
  return cookieNames.some((name) => /^sb-.+-auth-token/.test(name));
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const forwardedLocale = headerStore.get("x-next-intl-locale");
  const locale = (routing.locales as readonly string[]).includes(forwardedLocale ?? "")
    ? forwardedLocale!
    : detectLocale(
        cookieStore.get("NEXT_LOCALE")?.value,
        headerStore.get("accept-language")
      );

  const signedOut = !hasSupabaseSession(cookieStore.getAll().map((cookie) => cookie.name));

  return (
    <html
      lang={locale}
      dir="rtl"
      data-theme={cookieStore.get("theme")?.value ?? "dark"}
      className={rubik.variable}
      suppressHydrationWarning
    >
      <head>
        <Script id="pendo-install" strategy="beforeInteractive">
          {pendoInstallScript(signedOut)}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}

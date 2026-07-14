import { Rubik } from "next/font/google";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { detectLocale } from "@/i18n/detect-locale";
import { NotFoundContent } from "@/components/NotFoundContent";
import "@/app/globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

// Root not-found boundary: catches notFound() bubbling above [locale] (e.g.
// the layout's invalid-locale guard, hit via proxy-skipped paths like
// /signs/nope) and covers URLs that match no route. Rendered outside the
// locale layout with no next-intl request context, so it must supply its own
// <html> and resolve the locale itself from the NEXT_LOCALE cookie /
// Accept-Language header. Both supported locales are RTL, so dir stays fixed.
export default async function RootNotFound() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = detectLocale(
    cookieStore.get("NEXT_LOCALE")?.value,
    headerStore.get("accept-language")
  );
  const t = await getTranslations({ locale, namespace: "NotFound" });
  return (
    <html lang={locale} dir="rtl" className={rubik.variable}>
      <body>
        <NotFoundContent
          strings={{
            headline: t("headline"),
            support: t("support"),
            cta: t("cta"),
            signAlt: t("signAlt"),
          }}
          homeHref={`/${locale}`}
        />
      </body>
    </html>
  );
}

import { Rubik } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { NotFoundContent } from "@/components/NotFoundContent";
import "@/app/globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

// Root 404 boundary for requests with no locale context (unmatched by the
// proxy) and for notFound() thrown by the [locale] layout on invalid locales.
// Rendered outside the [locale] layout, so it must supply its own <html> and
// resolve strings explicitly in the default locale.
export default async function NotFound() {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "NotFound",
  });
  return (
    <html lang={routing.defaultLocale} dir="rtl" className={rubik.variable}>
      <body>
        <NotFoundContent
          strings={{
            headline: t("headline"),
            support: t("support"),
            cta: t("cta"),
            signAlt: t("signAlt"),
          }}
          homeHref={`/${routing.defaultLocale}`}
        />
      </body>
    </html>
  );
}

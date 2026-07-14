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

// Global 404, handled at the routing level: covers URLs that match no route
// and notFound() bubbling to the root (e.g. the [locale] layout's invalid-
// locale guard). Rendered outside any layout, so it must supply its own
// <html> and resolve strings explicitly in the default locale.
export default async function GlobalNotFound() {
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

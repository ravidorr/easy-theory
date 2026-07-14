import { getTranslations, getLocale } from "next-intl/server";
import { NotFoundContent } from "@/components/NotFoundContent";

// Localized 404 for unmatched paths under a valid locale (triggered by the
// [...rest] catch-all). Renders inside the locale layout, so theme, font,
// and direction come from there.
export default async function NotFound() {
  const t = await getTranslations("NotFound");
  const locale = await getLocale();
  return (
    <NotFoundContent
      strings={{
        headline: t("headline"),
        support: t("support"),
        cta: t("cta"),
        signAlt: t("signAlt"),
      }}
      homeHref={`/${locale}`}
    />
  );
}

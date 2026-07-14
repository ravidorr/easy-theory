import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

function isSupportedLocale(value: string | undefined): value is Locale {
  return (routing.locales as readonly string[]).includes(value ?? "");
}

/**
 * Resolve a visitor's locale outside any next-intl request context (e.g. the
 * global 404 boundary, where the proxy may not have run): prefer the
 * NEXT_LOCALE cookie set by the next-intl proxy, then the best-matching
 * Accept-Language entry, then the default locale.
 */
export function detectLocale(
  cookieLocale: string | undefined,
  acceptLanguage: string | null
): Locale {
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  const candidates = (acceptLanguage ?? "")
    .split(",")
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(";");
      const q = params
        .map((p) => p.trim().match(/^q=([\d.]+)$/i)?.[1])
        .find(Boolean);
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        q: Number(q ?? 1),
      };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q);

  const match = candidates.find(({ language }) => isSupportedLocale(language));
  return match ? (match.language as Locale) : routing.defaultLocale;
}

import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import heMessages from "../../messages/he.json";
import arMessages from "../../messages/ar.json";

// ar.json's literal string types differ from he.json's; key parity between the
// two files is enforced by src/app/__tests__/messages.test.ts.
const MESSAGES: Record<Locale, typeof heMessages> = {
  he: heMessages,
  ar: arMessages as typeof heMessages,
};

/**
 * Resolve the caller's locale from the NEXT_LOCALE cookie set by the
 * next-intl proxy. The proxy skips /api routes, so there is no next-intl
 * request context here — the cookie header is the only locale signal.
 */
export function getRequestLocale(request: Request): Locale {
  const value = (request.headers.get("cookie") ?? "").match(
    /(?:^|;\s*)NEXT_LOCALE=([^;]+)/
  )?.[1];
  return (routing.locales as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Translator for the Api namespace in the caller's locale. */
export function getApiTranslator(request: Request) {
  const locale = getRequestLocale(request);
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "Api",
  });
}

/** Translator for the Notify namespace (cron notifications, no request context). */
export function getNotifyTranslator(locale: Locale) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "Notify",
  });
}

/**
 * Parse a request body as a JSON object, returning null instead of throwing
 * on malformed JSON or non-object payloads so routes can respond 400.
 */
export async function parseJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

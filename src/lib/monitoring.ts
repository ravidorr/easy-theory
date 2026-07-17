import * as Sentry from "@sentry/nextjs";

// Non-Error values (e.g. plain rejection payloads) still need a stable
// message for the tracker to group on.
function describeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

// Central error reporting: keeps the established `[area] message:` console
// format (so Vercel logs are unchanged) and forwards the error to GlitchTip.
// Context must not contain secrets or push endpoints — it is sent verbatim
// to the external tracker.
export function reportError(
  area: string,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error(`[${area}] ${message}:`, error, ...(context ? [context] : []));
  const exception =
    error instanceof Error
      ? error
      : new Error(`[${area}] ${message}: ${describeError(error)}`, {
          cause: error,
        });
  Sentry.captureException(exception, {
    tags: { area },
    extra: { message: `[${area}] ${message}`, ...context },
  });
}

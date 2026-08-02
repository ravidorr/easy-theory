import * as Sentry from "@sentry/nextjs";

const REDACTED_SERVER_COMPONENT_ERROR = /Minified React error #441\b/;

// React #441 is the client-side wrapper for a Server Components failure. It
// intentionally omits the cause, while the server-side request hook records
// the actionable exception (for example, a failed database query).
export function isRedactedServerComponentError(event: {
  exception?: { values?: Array<{ value?: string }> };
}) {
  return event.exception?.values?.some(({ value }) =>
    REDACTED_SERVER_COMPONENT_ERROR.test(value ?? "")
  ) ?? false;
}

// Browser-side GlitchTip init. The SDK's global onerror/onunhandledrejection
// handlers also cover the vanilla scripts in public/js/, which have no error
// reporting of their own. Errors only — see src/instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  tracesSampleRate: 0,
  enabled:
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_GLITCHTIP_DSN),
  beforeSend(event) {
    return isRedactedServerComponentError(event) ? null : event;
  },
});

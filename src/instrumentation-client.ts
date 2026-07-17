import * as Sentry from "@sentry/nextjs";

// Browser-side GlitchTip init. The SDK's global onerror/onunhandledrejection
// handlers also cover the vanilla scripts in public/js/, which have no error
// reporting of their own. Errors only — see src/instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  tracesSampleRate: 0,
  enabled:
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_GLITCHTIP_DSN),
});

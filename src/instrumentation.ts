import * as Sentry from "@sentry/nextjs";

// Server-side GlitchTip init (GlitchTip is Sentry-API-compatible, so the
// official Sentry SDK is pointed at a GlitchTip DSN). Runs once per server
// runtime. Without a DSN, or outside production, the SDK is a no-op.
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
    // Errors only: tracing and replay would burn through GlitchTip's
    // 1,000 events/month free tier (and GlitchTip has no Session Replay).
    tracesSampleRate: 0,
    enabled:
      process.env.NODE_ENV === "production" &&
      Boolean(process.env.NEXT_PUBLIC_GLITCHTIP_DSN),
  });
}

// Captures errors from route handlers and server rendering that no local
// try/catch handled.
export const onRequestError = Sentry.captureRequestError;

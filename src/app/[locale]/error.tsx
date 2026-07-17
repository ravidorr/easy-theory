"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import styles from "./error.module.css";

// Segment-level error boundary for everything under [locale]. Data helpers
// (e.g. getMistakesForTopic) throw on failed queries instead of pretending
// the result is empty; this surfaces those failures in the user's language.
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className={styles.wrap}>
      {/* Inline svg (not the Icon component): this client error boundary is
          bundled into every page's JS, and importing Icon would ship the whole
          icon map on the happy path. Keep in sync with Icon's "warning". */}
      <svg
        width={48}
        height={48}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className={styles.icon}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </g>
      </svg>
      <div className={styles.textBlock}>
        <h1 className={styles.headline}>{t("headline")}</h1>
        <p className={styles.support}>{t("support")}</p>
      </div>
      <button onClick={reset} className={`btn-primary ${styles.retryBtn}`}>
        {t("retry")}
      </button>
      <Link href="/" className={`btn-secondary ${styles.homeLink}`}>
        {t("backHome")}
      </Link>
    </main>
  );
}

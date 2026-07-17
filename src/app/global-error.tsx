"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import heMessages from "../../messages/he.json";
import arMessages from "../../messages/ar.json";
import styles from "./global-error.module.css";

// Root error boundary for failures above the [locale] layout (where the
// next-intl provider lives). The locale is unknown here, so both languages
// are rendered, reusing the same Error strings as the [locale] boundary.
// Must render its own <html>/<body> because it replaces the root layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className={styles.wrap}>
        <div className={styles.textBlock}>
          <h1 className={styles.headline}>{heMessages.Error.headline}</h1>
          <p className={styles.support}>{heMessages.Error.support}</p>
        </div>
        <div className={styles.textBlock} lang="ar">
          <h1 className={styles.headline}>{arMessages.Error.headline}</h1>
          <p className={styles.support}>{arMessages.Error.support}</p>
        </div>
        <button onClick={reset} className={styles.retryBtn}>
          {heMessages.Error.retry} / {arMessages.Error.retry}
        </button>
      </body>
    </html>
  );
}

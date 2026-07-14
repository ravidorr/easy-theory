"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  }, [error]);

  return (
    <main className={styles.wrap}>
      <span className={styles.emoji} aria-hidden="true">
        ⚠️
      </span>
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

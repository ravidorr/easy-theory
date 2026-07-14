import Link from "next/link";
import styles from "./NotFoundContent.module.css";

export type NotFoundStrings = {
  headline: string;
  support: string;
  cta: string;
  signAlt: string;
};

// Shared 404 visual for both the localized ([locale]/not-found) and the root
// (locale-less) boundaries. Strings arrive as props because the root boundary
// resolves them outside the request's intl context.
export function NotFoundContent({
  strings,
  homeHref,
}: {
  strings: NotFoundStrings;
  homeHref: string;
}) {
  return (
    <main className={styles.wrap}>
      <svg
        width="150"
        height="150"
        viewBox="0 0 120 120"
        role="img"
        aria-label={strings.signAlt}
      >
        <circle cx="60" cy="60" r="58" fill="var(--sign-white)" />
        <circle cx="60" cy="60" r="54" fill="var(--sign-red)" />
        <rect x="20" y="47" width="80" height="26" rx="4" fill="var(--sign-white)" />
      </svg>
      <div className={styles.textBlock}>
        <h1 className={styles.headline}>{strings.headline}</h1>
        <p className={styles.support}>{strings.support}</p>
      </div>
      <Link href={homeHref} className={`btn-primary ${styles.cta}`}>
        {strings.cta}
      </Link>
    </main>
  );
}

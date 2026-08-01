import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonCol,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <SkeletonScreen label={t("label")} className={styles.page}>
      <header className={styles.hero}>
        <Skeleton variant="lineLg" size="w60" />
        <Skeleton size="w25" />
        <Skeleton variant="lineLg" size="w80" />
        <Skeleton size="w80" />
      </header>
      <section className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w80" />
        </div>
        <div className={styles.loginForm}>
          <Skeleton size="w25" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      </section>
      <section className={styles.previewSection}>
        <div className={styles.phoneFrame}>
          <Skeleton variant="image" size="fill" />
        </div>
        <Skeleton size="w60" />
      </section>
      <section className={styles.featuresSection}>
        <Skeleton variant="lineLg" size="w40" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.featureCard}>
            <Skeleton variant="circle" size="s64" />
            <SkeletonCol>
              <Skeleton size="w60" />
              <Skeleton size="w80" />
            </SkeletonCol>
          </div>
        ))}
      </section>
      <section className={styles.peekSection}>
        <Skeleton variant="lineLg" size="w40" />
        <div className={styles.peekRow}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.phoneFrameSmall}>
              <Skeleton variant="image" size="fill" />
            </div>
          ))}
        </div>
      </section>
      <section className={styles.faqSection}>
        <Skeleton variant="lineLg" size="w40" />
        <div className={styles.faqCard}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.faqItem}>
              <Skeleton size="w60" />
              <Skeleton size="w80" />
            </div>
          ))}
        </div>
      </section>
      <div className={styles.closeCard}>
        <Skeleton size="w80" />
        <Skeleton variant="block" />
      </div>
    </SkeletonScreen>
  );
}

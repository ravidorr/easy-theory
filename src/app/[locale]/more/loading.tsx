import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <Skeleton size="w60" />

        <section className={styles.pageSection}>
          <Skeleton size="w40" />
          <div className={styles.progressCard}>
            <div className={styles.progressCardTitleSkeleton}>
              <Skeleton variant="lineLg" size="w40" />
            </div>
            <div className={styles.statsGrid}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.statCell}>
                  <Skeleton variant="circle" />
                  <Skeleton size="w40" />
                  <Skeleton size="w60" />
                </div>
              ))}
            </div>
            <div className={styles.cardDivider} />
            <section className={styles.medalsSection}>
              <Skeleton variant="lineLg" size="w40" />
              <div className={styles.medalsGrid}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={styles.medalItem}>
                    <Skeleton variant="circle" />
                    <Skeleton size="w60" />
                    <Skeleton size="w40" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className={styles.pageSection}>
          <Skeleton size="w40" />
          <div className={styles.accountCard}>
            <nav>
              <div className={styles.listSectionTitle}>
                <Skeleton size="w40" />
              </div>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={styles.navRow}>
                  <Skeleton variant="block" size="s40" />
                  <Skeleton size="w60" />
                  <Skeleton variant="circle" />
                </div>
              ))}
            </nav>
            <div className={styles.cardDivider} />
            <section>
              <div className={styles.listSectionTitle}>
                <Skeleton size="w40" />
              </div>
              <div className={styles.settingsRow}>
                <Skeleton variant="block" size="s40" />
                <Skeleton size="w60" />
                <Skeleton variant="switch" />
              </div>
              <div className={styles.settingsRow}>
                <Skeleton variant="block" size="s40" />
                <Skeleton size="w60" />
                <Skeleton variant="switch" />
              </div>
              <div className={`${styles.settingsRow} ${styles.autoAdvanceDelayRow}`}>
                <Skeleton variant="block" size="s40" />
                <div className={styles.autoAdvanceDelayControl}>
                  <Skeleton size="w60" />
                  <div className={styles.autoAdvanceDelayInput}>
                    <Skeleton size="w25" />
                    <Skeleton variant="bar" />
                    <Skeleton size="w25" />
                  </div>
                  <Skeleton size="w40" />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <Skeleton variant="block" size="s40" />
                <Skeleton size="w60" />
                <Skeleton variant="pill" />
              </div>
            </section>
          </div>
        </section>

        <Skeleton variant="pill" size="w40" />
      </SkeletonScreen>
      <TabBar active="more" />
    </>
  );
}

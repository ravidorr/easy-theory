import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCard,
  SkeletonCol,
  SkeletonRow,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const [t, tHome] = await Promise.all([
    getTranslations("Loading"),
    getTranslations("Home"),
  ]);

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <div className={styles.topBar}>
          <span className={styles.wordmark}>{tHome("wordmark")}</span>
        </div>

        <div className={styles.greeting}>
          <Skeleton variant="lineLg" size="w60" />
          <Skeleton size="w80" />
          <Skeleton size="w40" />
        </div>

        <div className={styles.statsStrip}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.statTile}>
              <Skeleton variant="circle" />
              <Skeleton size="w40" />
              <Skeleton size="w60" />
            </div>
          ))}
        </div>

        <div className={styles.todayCard}>
          <Skeleton variant="pill" />
          <div className={styles.missionRow}>
            <Skeleton variant="circle" size="s72" />
            <SkeletonCol>
              <Skeleton variant="lineLg" size="w60" />
              <Skeleton size="w80" />
            </SkeletonCol>
          </div>
          <Skeleton variant="block" />
        </div>

        <div className={styles.readinessCard}>
          <Skeleton size="w40" />
          <Skeleton variant="pill" />
          <Skeleton size="w80" />
        </div>

        <div className={styles.examCta}>
          <Skeleton variant="block" size="s40" />
          <SkeletonCol>
            <Skeleton size="w40" />
            <Skeleton size="w60" />
          </SkeletonCol>
        </div>

        <div className={styles.topicsSection}>
          <div className={styles.topicsHeader}>
            <Skeleton variant="lineLg" size="w40" />
          </div>
          <div className={styles.overallProgress}>
            <Skeleton variant="bar" />
            <div className={styles.overallMeta}>
              <Skeleton size="w40" />
              <Skeleton size="w25" />
            </div>
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i}>
              <SkeletonRow>
                <Skeleton variant="block" size="s52" />
                <SkeletonCol>
                  <Skeleton size="w60" />
                  <Skeleton size="w40" />
                  <Skeleton variant="bar" />
                </SkeletonCol>
              </SkeletonRow>
            </SkeletonCard>
          ))}
        </div>
      </SkeletonScreen>
      <TabBar active="home" />
    </>
  );
}

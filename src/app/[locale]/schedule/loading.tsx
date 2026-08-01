import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonCol,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";
import { TabBar } from "@/components/TabBar";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
    <SkeletonScreen label={t("label")} className={styles.page}>
      <div className={styles.topBar}>
        <Skeleton variant="circle" size="s44" />
        <div className={styles.titleCol}>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w60" />
        </div>
      </div>
      <section className={styles.card}>
        <Skeleton size="w25" />
        <div className={styles.dayRow}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="circle" size="s44" />
          ))}
        </div>
        <Skeleton size="w60" />
      </section>
      <section className={styles.timeCard}>
        <div className={styles.timeLabel}>
          <Skeleton size="w25" />
          <Skeleton variant="control" />
        </div>
        <div className={styles.durationWrapper}>
          <Skeleton size="w25" />
          <div className={styles.durationRow}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="pillFlex" />
            ))}
          </div>
        </div>
        <div className={styles.notifyLabel}>
          <Skeleton variant="switch" />
          <SkeletonCol>
            <Skeleton size="w60" />
            <Skeleton size="w40" />
          </SkeletonCol>
        </div>
      </section>
      <div className={styles.saveArea}>
        <div className={styles.summaryCard}>
          <Skeleton size="w60" />
          <Skeleton size="w40" />
        </div>
        <Skeleton variant="block" />
      </div>
    </SkeletonScreen>
    <TabBar active="more" current={null} />
    </>
  );
}

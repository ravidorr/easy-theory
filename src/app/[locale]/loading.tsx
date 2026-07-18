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
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />

        <div className={styles.todayCard}>
          <div className={styles.missionRow}>
            <Skeleton variant="circle" size="s72" />
            <SkeletonCol>
              <Skeleton variant="lineLg" size="w60" />
              <Skeleton size="w80" />
              <Skeleton size="w40" />
            </SkeletonCol>
          </div>
          <Skeleton variant="block" />
        </div>

        <div className={styles.examCta}>
          <Skeleton variant="block" size="s40" />
          <SkeletonCol>
            <Skeleton size="w40" />
            <Skeleton size="w60" />
            <Skeleton size="w40" />
          </SkeletonCol>
        </div>

        <div className={styles.topicsSection}>
          <Skeleton variant="lineLg" size="w40" />
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

import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCol,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />

        <section className={styles.todayCard}>
          <div className={styles.missionRow}>
            <Skeleton variant="circle" size="s72" />
            <SkeletonCol>
              <Skeleton variant="lineLg" size="w60" />
              <Skeleton size="w80" />
              <Skeleton size="w40" />
            </SkeletonCol>
          </div>
          <Skeleton variant="block" />
        </section>

        <section className={styles.examCta}>
          <div className={styles.examCtaIcon}>
            <Skeleton variant="block" size="s40" />
          </div>
          <SkeletonCol>
            <Skeleton size="w40" />
            <Skeleton size="w60" />
            <Skeleton size="w40" />
          </SkeletonCol>
        </section>

        <section className={styles.topicsSection}>
          <Skeleton variant="lineLg" size="w40" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.topicLink}>
              <div className={styles.topicIconWrap}>
                <Skeleton variant="block" size="s40" />
              </div>
              <div className={styles.topicBody}>
                <div className={styles.topicTitleRow}>
                  <Skeleton size="w60" />
                  <Skeleton size="w40" />
                </div>
                <div className={styles.progressTrack}>
                  <Skeleton variant="bar" size="fill" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </SkeletonScreen>
      <TabBar active="home" />
    </>
  );
}

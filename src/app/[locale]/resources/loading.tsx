import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import { Skeleton, SkeletonCol, SkeletonScreen } from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <div className={styles.section}>
          <Skeleton variant="lineLg" size="w40" />
          <div className={styles.featuredLink}>
            <div className={styles.thumbnailFeatured}>
              <Skeleton variant="image" size="fill" />
            </div>
            <div className={styles.videoMeta}>
              <Skeleton size="w60" />
              <Skeleton size="w80" />
            </div>
          </div>
          {[0].map((i) => (
            <div key={i} className={styles.rowLink}>
              <div className={styles.thumbnailRow}>
                <Skeleton variant="image" size="fill" />
              </div>
              <SkeletonCol>
                <Skeleton size="w60" />
                <Skeleton size="w80" />
              </SkeletonCol>
            </div>
          ))}
        </div>
        <div className={styles.section}>
          <Skeleton variant="lineLg" size="w40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.rowLink}>
              <div className={styles.thumbnailRow}>
                <Skeleton variant="image" size="fill" />
              </div>
              <SkeletonCol>
                <Skeleton size="w60" />
                <Skeleton variant="pill" />
              </SkeletonCol>
            </div>
          ))}
        </div>
        {[0, 1].map((section) => (
          <div key={section} className={styles.section}>
            <Skeleton variant="lineLg" size="w40" />
            {section === 0 && (
              <div className={styles.featuredLink}>
                <div className={styles.featuredVisual}>
                  <Skeleton variant="image" size="fill" />
                </div>
                <div className={styles.featuredBody}>
                  <Skeleton size="w60" />
                  <Skeleton size="w80" />
                </div>
              </div>
            )}
            {Array.from({ length: section === 0 ? 1 : 2 }, (_, i) => (
              <div key={i} className={styles.resourceLink}>
                <div className={styles.iconWrap}>
                  <Skeleton variant="block" size="s52" />
                </div>
                <SkeletonCol>
                  <Skeleton size="w60" />
                  <Skeleton size="w80" />
                </SkeletonCol>
              </div>
            ))}
          </div>
        ))}
      </SkeletonScreen>
      <TabBar active="more" current={null} />
    </>
  );
}

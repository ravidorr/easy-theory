import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCard,
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
        <div className={styles.statsCard}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.statCell}>
              <Skeleton variant="circle" />
              <Skeleton size="w40" />
              <Skeleton size="w60" />
            </div>
          ))}
        </div>
        <SkeletonCard>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i}>
              <Skeleton variant="circle" />
              <Skeleton size="w60" />
            </SkeletonRow>
          ))}
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton size="w40" />
          <Skeleton size="w80" />
          <Skeleton size="w80" />
        </SkeletonCard>
      </SkeletonScreen>
      <TabBar active="more" />
    </>
  );
}

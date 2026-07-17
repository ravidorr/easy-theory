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
        <Skeleton size="w80" />
        <SkeletonCard>
          <Skeleton variant="image" />
          <Skeleton size="w60" />
          <Skeleton size="w40" />
        </SkeletonCard>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonRow>
              <Skeleton variant="block" size="s52" />
              <SkeletonCol>
                <Skeleton size="w60" />
                <Skeleton size="w40" />
              </SkeletonCol>
            </SkeletonRow>
          </SkeletonCard>
        ))}
      </SkeletonScreen>
      <TabBar active="videos" />
    </>
  );
}

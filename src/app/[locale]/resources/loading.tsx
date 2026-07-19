import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCard,
  SkeletonIconCard,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <div className={styles.section}>
          <Skeleton size="w25" />
          <SkeletonCard>
            <Skeleton variant="image" />
            <Skeleton size="w60" />
            <Skeleton size="w40" />
          </SkeletonCard>
          <SkeletonIconCard />
        </div>
        <div className={styles.section}>
          <Skeleton size="w25" />
          {[0, 1].map((i) => (
            <SkeletonIconCard key={i} />
          ))}
        </div>
      </SkeletonScreen>
      <TabBar active="links" />
    </>
  );
}

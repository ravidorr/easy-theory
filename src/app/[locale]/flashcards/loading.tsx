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
        <SkeletonCol>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w25" />
        </SkeletonCol>
        <Skeleton variant="bar" />
        <SkeletonCard>
          <Skeleton variant="image" />
          <Skeleton size="w60" />
        </SkeletonCard>
        <SkeletonRow>
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </SkeletonRow>
      </SkeletonScreen>
      <TabBar active="cards" />
    </>
  );
}

import { getTranslations } from "next-intl/server";
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
    <SkeletonScreen label={t("label")} className={styles.page}>
      <SkeletonRow>
        <Skeleton variant="circle" size="s40" />
        <SkeletonCol>
          <Skeleton size="w40" />
          <Skeleton size="w25" />
        </SkeletonCol>
      </SkeletonRow>
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
  );
}

import { getTranslations } from "next-intl/server";
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
    <SkeletonScreen label={t("label")} className={styles.page}>
      <SkeletonRow>
        <Skeleton variant="circle" size="s40" />
      </SkeletonRow>
      <Skeleton variant="lineLg" size="w60" />
      <Skeleton size="w80" />
      <SkeletonCard>
        <Skeleton size="w40" />
        <Skeleton size="w80" />
        <Skeleton size="w80" />
        <Skeleton size="w60" />
      </SkeletonCard>
      <Skeleton variant="block" />
      <SkeletonCard>
        <Skeleton size="w40" />
        <Skeleton size="w60" />
        <Skeleton size="w60" />
      </SkeletonCard>
    </SkeletonScreen>
  );
}

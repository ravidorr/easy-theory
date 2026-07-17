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
        <Skeleton variant="bar" />
        <Skeleton size="w25" />
      </SkeletonRow>
      <SkeletonCard>
        <Skeleton variant="image" />
        <Skeleton variant="lineLg" />
        <Skeleton size="w80" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="block" />
        ))}
      </SkeletonCard>
      <Skeleton variant="block" />
    </SkeletonScreen>
  );
}

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
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w60" />
        </SkeletonCol>
      </SkeletonRow>
      <SkeletonCard>
        <Skeleton size="w25" />
        <SkeletonRow>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} variant="circle" size="s40" />
          ))}
        </SkeletonRow>
        <Skeleton size="w60" />
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton size="w25" />
        <Skeleton variant="block" />
        <Skeleton size="w25" />
        <SkeletonRow>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="pill" />
          ))}
        </SkeletonRow>
      </SkeletonCard>
      <Skeleton variant="block" />
    </SkeletonScreen>
  );
}

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
        <Skeleton variant="lineLg" size="w40" />
      </SkeletonRow>
      <Skeleton variant="pill" />
      <Skeleton size="w40" />
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i}>
          <Skeleton size="w80" />
          {[0, 1, 2, 3].map((j) => (
            <Skeleton key={j} variant="block" />
          ))}
        </SkeletonCard>
      ))}
    </SkeletonScreen>
  );
}

import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCard,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <Skeleton size="w40" />
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton variant="image" />
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} variant="block" />
            ))}
          </SkeletonCard>
        ))}
      </SkeletonScreen>
      <TabBar active="more" />
    </>
  );
}

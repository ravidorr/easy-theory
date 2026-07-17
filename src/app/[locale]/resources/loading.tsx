import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import { Skeleton, SkeletonIconCard, SkeletonScreen } from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <Skeleton size="w80" />
        {[0, 1].map((section) => (
          <div key={section} className={styles.section}>
            <Skeleton size="w25" />
            {[0, 1, 2].map((i) => (
              <SkeletonIconCard key={i} />
            ))}
          </div>
        ))}
      </SkeletonScreen>
      <TabBar active="links" />
    </>
  );
}

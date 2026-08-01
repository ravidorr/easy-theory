import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonCol,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w40" />
        <Skeleton size="w60" />
        {[3, 4].map((count, section) => (
          <div key={section} className={styles.section}>
            <Skeleton variant="lineLg" size="w40" />
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={styles.resourceLink}>
                <div className={styles.iconWrap}>
                  <Skeleton variant="block" size="s52" />
                </div>
                <SkeletonCol>
                  <Skeleton size="w60" />
                  <Skeleton size="w80" />
                </SkeletonCol>
              </div>
            ))}
          </div>
        ))}
      </SkeletonScreen>
      <TabBar active="more" current={null} />
    </>
  );
}

import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";
import { TabBar } from "@/components/TabBar";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <div className={styles.topBar}>
          <Skeleton variant="circle" size="s44" />
          <Skeleton variant="lineLg" size="w40" />
        </div>
        <div className={styles.scopeToggle}>
          <div className={styles.scopeOption}><Skeleton size="w60" /></div>
          <div className={styles.scopeOption}><Skeleton size="w60" /></div>
        </div>
        <Skeleton size="w40" />
        {[0, 1, 2].map((i) => (
          <section key={i} className={styles.questionCard}>
            <div className={styles.imgWide}>
              <Skeleton variant="image" size="fill" />
            </div>
            <Skeleton variant="lineLg" size="w80" />
            <div className={styles.optionsList}>
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} variant="block" />
              ))}
            </div>
          </section>
        ))}
      </SkeletonScreen>
    <TabBar active="practice" current={null} />
    </>
  );
}

import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonScreen,
} from "@/components/Skeleton";
import { TabBar } from "@/components/TabBar";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <Skeleton variant="lineLg" size="w60" />
        <Skeleton size="w80" />
        <section className={styles.rulesCard}>
          <Skeleton size="w40" />
          <Skeleton size="w80" />
          <Skeleton size="w80" />
          <Skeleton size="w60" />
        </section>
        <Skeleton variant="block" />
        <section className={styles.historyCard}>
          <Skeleton size="w40" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.attemptRow}>
              <Skeleton size="w40" />
              <Skeleton size="w25" />
            </div>
          ))}
        </section>
      </SkeletonScreen>
      <TabBar active="exam" />
    </>
  );
}

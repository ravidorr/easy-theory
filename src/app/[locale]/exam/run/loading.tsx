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
          <div className={styles.progressTrack}>
            <Skeleton variant="bar" size="fill" />
          </div>
          <Skeleton variant="content" />
          <Skeleton variant="content" />
        </div>
        <section className={`quiz-slide ${styles.slideItem}`} style={{ display: "flex" }}>
          <div className={styles.questionContainer}>
            <div className={styles.imgWide}>
              <Skeleton variant="image" size="fill" />
            </div>
            <Skeleton variant="lineLg" size="w80" />
          </div>
          <div className={styles.optionsList}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="quiz-option">
                <Skeleton size="w60" />
              </div>
            ))}
          </div>
        </section>
        <footer className={styles.examFooter}>
          <Skeleton size="w40" />
          <Skeleton variant="block" />
          <div className={styles.navButtons}>
            <Skeleton variant="block" />
            <Skeleton variant="block" />
          </div>
        </footer>
      </SkeletonScreen>
    <TabBar active="exam" current={null} />
    </>
  );
}

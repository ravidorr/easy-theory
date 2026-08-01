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
          <div className={styles.progressTrack}>
            <Skeleton variant="bar" size="fill" />
          </div>
          <Skeleton size="w25" />
        </div>
        <section className={`quiz-slide ${styles.slideItem}`} style={{ display: "flex" }}>
          <div className={styles.questionContainer}>
            <div className={styles.questionActions}>
              <Skeleton variant="circle" size="s40" />
              <Skeleton variant="pill" />
            </div>
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
        <footer className={styles.quizFooter}>
          <div className={styles.rewardBanner}>
            <Skeleton variant="pill" />
            <Skeleton size="w40" />
          </div>
          <Skeleton variant="block" />
        </footer>
      </SkeletonScreen>
    <TabBar active="practice" current={null} />
    </>
  );
}

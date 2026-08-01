import { getTranslations } from "next-intl/server";
import { TabBar } from "@/components/TabBar";
import {
  Skeleton,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <>
      <SkeletonScreen label={t("label")} className={styles.page}>
        <div>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w25" />
        </div>
        <div className={styles.progressTrack}>
          <Skeleton variant="bar" size="fill" />
        </div>
        <div className={styles.cardsContainer}>
          <div className={`flashcard-wrap ${styles.flashcardItem}`} style={{ display: "flex" }}>
            <div className="flashcard-inner">
              <div className="flashcard-face">
                <Skeleton variant="image" size="fill" />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.actionsRow}>
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
        <Skeleton size="w40" />
      </SkeletonScreen>
      <TabBar active="practice" current={null} />
    </>
  );
}

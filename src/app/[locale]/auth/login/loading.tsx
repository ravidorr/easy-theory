import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonScreen,
} from "@/components/Skeleton";
import styles from "./page.module.css";

export default async function Loading() {
  const t = await getTranslations("Loading");

  return (
    <SkeletonScreen label={t("label")} className={styles.page}>
      <header className={styles.hero}>
        <Skeleton variant="lineLg" size="w60" />
        <Skeleton size="w25" />
      </header>
      <section className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w80" />
        </div>
        <div className={styles.loginForm}>
          <Skeleton size="w25" />
          <Skeleton variant="block" />
          <Skeleton variant="block" />
        </div>
      </section>
    </SkeletonScreen>
  );
}

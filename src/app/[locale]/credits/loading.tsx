import { getTranslations } from "next-intl/server";
import {
  Skeleton,
  SkeletonCol,
  SkeletonIconCard,
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
        <SkeletonCol>
          <Skeleton variant="lineLg" size="w40" />
          <Skeleton size="w60" />
        </SkeletonCol>
      </SkeletonRow>
      {[0, 1].map((section) => (
        <div key={section} className={styles.section}>
          <Skeleton size="w25" />
          {[0, 1, 2].map((i) => (
            <SkeletonIconCard key={i} />
          ))}
        </div>
      ))}
    </SkeletonScreen>
  );
}

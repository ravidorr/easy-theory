import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <Icon name="play" size={size} className={styles.playIcon} />
);

export default async function VideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/videos");

  const t = await getTranslations("Videos");

  const lessons = [
    { id: "vk37Vd80S2E", title: t("lesson1Title"), tag: t("lesson1Tag") },
    { id: "Rp4wFyF-dok", title: t("lesson2Title"), tag: t("lesson2Tag") },
    { id: "nwbIrAdn8Qc", title: t("lesson3Title"), tag: t("lesson3Tag") },
    { id: "kJ5y5JlkMjc", title: t("lesson4Title"), tag: t("lesson4Tag") },
  ];

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
          <span className={styles.subtitle}>{t("subtitle")}</span>
        </div>

        <div className={styles.section}>
          <h2>{t("marathonsTitle")}</h2>

          <a
            href="https://www.youtube.com/watch?v=gd6ES_aAdI0"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.featuredLink}
          >
            <div className={styles.thumbnailFeatured}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://i.ytimg.com/vi/gd6ES_aAdI0/hqdefault.jpg"
                alt=""
                className={styles.thumbnailImg}
              />
              <span className={styles.playBtnLg}>
                <PlayIcon size={20} />
              </span>
              <span className={styles.durationBadge}>{t("featuredDuration")}</span>
            </div>
            <div className={styles.videoMeta}>
              <span className={styles.videoTitle}>{t("featuredTitle")}</span>
              <span className={styles.videoDesc}>{t("featuredDesc")}</span>
            </div>
          </a>

          <a
            href="https://www.youtube.com/watch?v=WsVi4kEiaPE"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.rowLink}
          >
            <div className={styles.thumbnailRow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://i.ytimg.com/vi/WsVi4kEiaPE/hqdefault.jpg"
                alt=""
                className={styles.thumbnailImg}
              />
              <span className={styles.playBtnSm}>
                <PlayIcon size={12} />
              </span>
            </div>
            <div className={styles.videoBody}>
              <span className={styles.videoTitle}>{t("rowTitle1")}</span>
              <span className={styles.videoDesc}>{t("rowDesc1")}</span>
            </div>
          </a>
        </div>

        <div className={styles.section}>
          <h2>{t("lessonsTitle")}</h2>

          {lessons.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.rowLink}
            >
              <div className={styles.thumbnailRow}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                  alt=""
                  className={styles.thumbnailImg}
                />
                <span className={styles.playBtnSm}>
                  <PlayIcon size={12} />
                </span>
              </div>
              <div className={styles.videoBody}>
                <span className={styles.videoTitle}>{video.title}</span>
                <span className={styles.videoTag}>{video.tag}</span>
              </div>
            </a>
          ))}
        </div>

        <span className={styles.pageNote}>{t("pageNote")}</span>
      </main>
      <TabBar active="videos" />
    </>
  );
}

import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getVideos } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedContent } from "@/lib/content-locale";
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
  const locale = await getLocale();
  const loc = (he: string | null, ar: string | null) => localizedContent(locale, he, ar);

  const videos = await getVideos(supabase);
  const featured = videos.find((v) => v.section === "marathon" && v.is_featured);
  const marathons = videos.filter((v) => v.section === "marathon" && !v.is_featured);
  const lessons = videos.filter((v) => v.section === "lesson");

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
          <span className={styles.subtitle}>{t("subtitle")}</span>
        </div>

        <div className={styles.section}>
          <h2>{t("marathonsTitle")}</h2>

          {featured && (
            <a
              href={`https://www.youtube.com/watch?v=${featured.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.featuredLink}
            >
              <div className={styles.thumbnailFeatured}>
                <Image
                  src={`https://i.ytimg.com/vi/${featured.youtube_id}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 100vw, 440px"
                  className={styles.thumbnailImg}
                />
                <span className={styles.playBtnLg}>
                  <PlayIcon size={20} />
                </span>
                {featured.duration_label_he && (
                  <span className={styles.durationBadge}>
                    {loc(featured.duration_label_he, featured.duration_label_ar)}
                  </span>
                )}
              </div>
              <div className={styles.videoMeta}>
                <span className={styles.videoTitle}>
                  {loc(featured.title_he, featured.title_ar)}
                </span>
                <span className={styles.videoDesc}>
                  {loc(featured.description_he, featured.description_ar)}
                </span>
              </div>
            </a>
          )}

          {marathons.map((video) => (
            <a
              key={video.youtube_id}
              href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.rowLink}
            >
              <div className={styles.thumbnailRow}>
                <Image
                  src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="120px"
                  className={styles.thumbnailImg}
                />
                <span className={styles.playBtnSm}>
                  <PlayIcon size={12} />
                </span>
              </div>
              <div className={styles.videoBody}>
                <span className={styles.videoTitle}>
                  {loc(video.title_he, video.title_ar)}
                </span>
                <span className={styles.videoDesc}>
                  {loc(video.description_he, video.description_ar)}
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className={styles.section}>
          <h2>{t("lessonsTitle")}</h2>

          {lessons.map((video) => (
            <a
              key={video.youtube_id}
              href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.rowLink}
            >
              <div className={styles.thumbnailRow}>
                <Image
                  src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="120px"
                  className={styles.thumbnailImg}
                />
                <span className={styles.playBtnSm}>
                  <PlayIcon size={12} />
                </span>
              </div>
              <div className={styles.videoBody}>
                <span className={styles.videoTitle}>
                  {loc(video.title_he, video.title_ar)}
                </span>
                <span className={styles.videoTag}>
                  {loc(video.tag_he, video.tag_ar)}
                </span>
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

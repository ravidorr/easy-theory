import { redirect } from "next/navigation";
import Image from "next/image";
import { SignImage } from "@/components/SignImage";
import { createClient } from "@/lib/supabase";
import { getResources, getVideos, type Resource } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getLocale, getTranslations } from "next-intl/server";
import { localizedContent } from "@/lib/content-locale";
import styles from "./page.module.css";

const iconWrapVariants: Record<Resource["icon_variant"], string> = {
  neutral: styles.iconWrapNeutral,
  primary: styles.iconWrapPrimary,
  success: styles.iconWrapSuccess,
  muted: styles.iconWrapMuted,
};

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <Icon name="play" size={size} className={styles.playIcon} />
);

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/resources");

  const [t, videosT] = await Promise.all([
    getTranslations("Resources"),
    getTranslations("Videos"),
  ]);
  const locale = await getLocale();
  const loc = (he: string | null, ar: string | null) => localizedContent(locale, he, ar);

  const [resources, videos] = await Promise.all([getResources(supabase), getVideos(supabase)]);
  const featuredVideo = videos.find((video) => video.section === "marathon" && video.is_featured);
  const marathons = videos.filter((video) => video.section === "marathon" && !video.is_featured);
  const lessons = videos.filter((video) => video.section === "lesson");
  const [featured, ...officialResources] = resources.filter((resource) => resource.section === "official");
  const sections = [
    { title: t("officialTitle"), featured, items: officialResources },
    {
      title: t("practiceTitle"),
      featured: undefined,
      items: resources.filter((resource) => resource.section === "practice"),
    },
  ];

  return (
    <>
      <main className={styles.page}>
        <div>
          <h1>{t("pageTitle")}</h1>
        </div>

        <div className={styles.section}>
          <h2>{videosT("marathonsTitle")}</h2>

          {featuredVideo && (
            <a
              href={`https://www.youtube.com/watch?v=${featuredVideo.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`pressable-card ${styles.featuredLink}`}
            >
              <div className={styles.thumbnailFeatured}>
                <Image
                  src={`https://i.ytimg.com/vi/${featuredVideo.youtube_id}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 100vw, 440px"
                  className={styles.thumbnailImg}
                />
                <span className={styles.playBtnLg}>
                  <PlayIcon size={20} />
                </span>
                {featuredVideo.duration_label_he && (
                  <span className={styles.durationBadge}>
                    {loc(featuredVideo.duration_label_he, featuredVideo.duration_label_ar)}
                  </span>
                )}
              </div>
              <div className={styles.videoMeta}>
                <span className={styles.videoTitle}>
                  <Icon name="youtube" size={16} className={styles.youtubeIcon} />
                  {loc(featuredVideo.title_he, featuredVideo.title_ar)}
                </span>
                <span className={styles.videoDesc}>
                  {loc(featuredVideo.description_he, featuredVideo.description_ar)}
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
              className={`pressable-card ${styles.rowLink}`}
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
                  <Icon name="youtube" size={16} className={styles.youtubeIcon} />
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
          <h2>{videosT("lessonsTitle")}</h2>

          {lessons.map((video) => (
            <a
              key={video.youtube_id}
              href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`pressable-card ${styles.rowLink}`}
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
                  <Icon name="youtube" size={16} className={styles.youtubeIcon} />
                  {loc(video.title_he, video.title_ar)}
                </span>
                <span className={styles.videoTag}>
                  {loc(video.tag_he, video.tag_ar)}
                </span>
              </div>
            </a>
          ))}
        </div>

        {sections.map((section) => (
          <div key={section.title} className={styles.section}>
            <h2>{section.title}</h2>

            {section.featured && (
              <a
                href={section.featured.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`pressable-card ${styles.featuredLink}`}
                data-testid="featured-resource"
              >
                <div className={styles.featuredVisual}>
                  {section.featured.icon_type === "sign" ? (
                    <SignImage src={section.featured.icon_value} size="md" />
                  ) : (
                    <span className={styles.featuredChar}>{section.featured.icon_value}</span>
                  )}
                </div>
                <div className={styles.featuredBody}>
                  <span className={styles.resourceTitle}>
                    {loc(section.featured.title_he, section.featured.title_ar)}
                  </span>
                  <span className={styles.resourceDesc}>
                    {loc(section.featured.description_he, section.featured.description_ar)}
                  </span>
                </div>
              </a>
            )}

            {section.items.map((resource) => (
              <a
                key={resource.href}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`pressable-card ${styles.resourceLink}`}
              >
                <div className={`${styles.iconWrap} ${iconWrapVariants[resource.icon_variant]}`}>
                  {resource.icon_type === "sign" ? (
                    <SignImage src={resource.icon_value} size="xs" />
                  ) : (
                    resource.icon_value
                  )}
                </div>
                <div className={styles.resourceBody}>
                  <span className={styles.resourceTitle}>
                    {loc(resource.title_he, resource.title_ar)}
                  </span>
                  <span className={styles.resourceDesc}>
                    {loc(resource.description_he, resource.description_ar)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ))}

        <span className={styles.pageNote}>{t("pageNote")}</span>
      </main>
      <TabBar active="more" current={null} />
    </>
  );
}

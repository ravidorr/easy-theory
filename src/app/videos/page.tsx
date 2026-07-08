import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import styles from "./page.module.css";

const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" className={styles.playIcon}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export default async function VideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <main className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <Link href="/more" className={styles.backBtn}>
          →
        </Link>
        <div className={styles.titleCol}>
          <h1>סרטוני לימוד</h1>
          <span className={styles.subtitle}>שיעורים קצרים ומרתונים, לפי נושא.</span>
        </div>
      </div>

      {/* Marathons */}
      <div className={styles.section}>
        <h2>מרתונים</h2>

        {/* Featured video */}
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
            <span className={styles.durationBadge}>40 דק׳</span>
          </div>
          <div className={styles.videoMeta}>
            <span className={styles.videoTitle}>מרתון הכנה למבחן התיאוריה</span>
            <span className={styles.videoDesc}>סיכום נושאי הליבה: זמני תגובה, הסחות דעת ועוד</span>
          </div>
        </a>

        {/* Row variant */}
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
            <span className={styles.videoTitle}>שיעור חזרה מרוכז</span>
            <span className={styles.videoDesc}>מעבר על חומר הליבה הנדרש למבחן</span>
          </div>
        </a>
      </div>

      {/* Topic lessons */}
      <div className={styles.section}>
        <h2>שיעורים לפי נושא</h2>

        {[
          {
            id: "vk37Vd80S2E",
            title: "מבוא לתמרורים",
            tag: "תמרורים",
          },
          {
            id: "Rp4wFyF-dok",
            title: "זכות קדימה בצמתים",
            tag: "זכות קדימה",
          },
          {
            id: "nwbIrAdn8Qc",
            title: "התנהגות בצמתים מורכבים",
            tag: "זכות קדימה",
          },
        ].map((video) => (
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

      <span className={styles.pageNote}>הסרטונים נפתחים ביוטיוב</span>
    </main>
  );
}

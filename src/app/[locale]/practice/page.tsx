import Link from "next/link";
import Image from "next/image";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getTopics } from "@/lib/db";
import { localizedRecordField } from "@/lib/content-locale";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import styles from "./page.module.css";

export default async function PracticePage() {
  const supabase = await createClient();
  await requireAuthenticatedUser(supabase, "/auth/login?next=/practice");
  const [topics, t, locale] = await Promise.all([
    getTopics(supabase),
    getTranslations("Practice"),
    getLocale(),
  ]);
  return <>
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>

      <Link className={`pressable-card ${styles.reviewCard}`} href="/mistakes">
        <span className={styles.reviewIcon}><Icon name="warning" size={20} /></span>
        <span className={styles.reviewLabel}>{t("reviewMistakes")}</span>
        <Icon name="chevron-left" size={20} className={styles.chevron} />
      </Link>

      <div className={styles.topicList}>
        {topics.map((topic) => (
          <Link className={`pressable-row ${styles.topicRow}`} key={topic.id} href={`/topics/${topic.slug}`}>
            <span className={styles.topicIcon}>
              {topic.icon ? (
                <Image src={topic.icon} alt="" width={32} height={32} className={styles.topicIconImg} />
              ) : (
                <Icon name="cards" size={20} />
              )}
            </span>
            <span className={styles.topicLabel}>{localizedRecordField(locale, topic, "name_he", "name_ar")}</span>
            <Icon name="chevron-left" size={20} className={styles.chevron} />
          </Link>
        ))}
      </div>
    </main>
    <TabBar active="practice" />
  </>;
}

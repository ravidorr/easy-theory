import { redirect } from "next/navigation";
import { Link } from "@/lib/navigation";
import Image from "next/image";
import { TabBar } from "@/components/TabBar";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase";
import { getMistakesForTopic, getTopics } from "@/lib/db";
import { localizedRecordField } from "@/lib/content-locale";
import { getLocale, getTranslations } from "next-intl/server";
import styles from "./page.module.css";

export default async function MistakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/mistakes");
  const [topics, t, locale] = await Promise.all([
    getTopics(supabase),
    getTranslations("Mistakes"),
    getLocale(),
  ]);
  const rows = await Promise.all(topics.map(async (topic) => ({ topic, mistakes: await getMistakesForTopic(supabase, user.id, topic.id) })));
  const rowsWithMistakes = rows.filter((row) => row.mistakes.length > 0);

  return <>
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>

      {rowsWithMistakes.length > 0 ? (
        <div className={styles.topicList}>
          {rowsWithMistakes.map(({ topic, mistakes }) => (
            <Link
              className={`pressable-row ${styles.topicRow}`}
              key={topic.id}
              href={`/topics/${topic.slug}/review?scope=all`}
            >
              <span className={styles.topicIcon}>
                {topic.icon ? (
                  <Image src={topic.icon} alt="" width={34} height={34} className={styles.topicIconImg} />
                ) : (
                  <Icon name="warning" size={22} />
                )}
              </span>
              <span className={styles.topicContent}>
                <span className={styles.topicLabel}>
                  {localizedRecordField(locale, topic, "name_he", "name_ar")}
                </span>
                <span className={styles.mistakeCount}>{t("count", { count: mistakes.length })}</span>
              </span>
              <Icon name="chevron-left" size={20} className={styles.chevron} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          icon="check"
          tone="success"
          title={t("emptyTitle")}
          description={t("empty")}
          actions={<Link href="/practice" className="btn-primary">{t("emptyCta")}</Link>}
        />
      )}
    </main>
    <TabBar active="practice" current={null} />
  </>;
}

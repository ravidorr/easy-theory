import { redirect } from "next/navigation";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase";
import { getMistakesForTopic, getTopics } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function MistakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/mistakes");
  const [topics, t] = await Promise.all([getTopics(supabase), getTranslations("Mistakes")]);
  const rows = await Promise.all(topics.map(async (topic) => ({ topic, mistakes: await getMistakesForTopic(supabase, user.id, topic.id) })));
  return <><main className="simple-page"><h1>{t("title")}</h1><p>{t("intro")}</p>{rows.filter((row) => row.mistakes.length > 0).map(({ topic, mistakes }) => (
    <Link className="pressable-row" key={topic.id} href={`/topics/${topic.slug}/review`}>{topic.name_he} · {t("count", { count: mistakes.length })}</Link>
  ))}{rows.every((row) => row.mistakes.length === 0) && <p>{t("empty")}</p>}</main><TabBar active="practice" current={null} /></>;
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase";
import { getTopics } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/practice");
  const [topics, t] = await Promise.all([getTopics(supabase), getTranslations("Practice")]);
  return <><main className="simple-page"><h1>{t("title")}</h1><p>{t("intro")}</p>{topics.map((topic) => (
    <Link className="pressable-row" key={topic.id} href={`/topics/${topic.slug}`}>{topic.name_he}</Link>
  ))}</main><TabBar active="practice" /></>;
}

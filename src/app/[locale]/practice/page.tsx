import { redirect } from "next/navigation";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase";
import { getTopics } from "@/lib/db";
import { localizedRecordField } from "@/lib/content-locale";
import { getLocale, getTranslations } from "next-intl/server";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/practice");
  const [topics, t, locale] = await Promise.all([
    getTopics(supabase),
    getTranslations("Practice"),
    getLocale(),
  ]);
  return <><main className="simple-page"><h1>{t("title")}</h1><p>{t("intro")}</p><Link className="pressable-row" href="/mistakes">{t("reviewMistakes")}</Link>{topics.map((topic) => (
    <Link className="pressable-row" key={topic.id} href={`/topics/${topic.slug}`}>
      {localizedRecordField(locale, topic, "name_he", "name_ar")}
    </Link>
  ))}</main><TabBar active="practice" /></>;
}

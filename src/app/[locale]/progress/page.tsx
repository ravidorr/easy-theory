import { redirect } from "next/navigation";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase";
import { getExamAttempts, getTopicAccuracy, getUserStats } from "@/lib/db";
import { computeReadiness } from "@/lib/readiness";
import { readinessConfidence } from "@/lib/learner-plan";
import { getTranslations } from "next-intl/server";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/progress");
  const [stats, attempts, accuracy, t] = await Promise.all([getUserStats(supabase, user.id), getExamAttempts(supabase, user.id), getTopicAccuracy(supabase, user.id), getTranslations("Progress")]);
  const readiness = computeReadiness(attempts);
  const answered = accuracy.reduce((sum, row) => sum + row.total, 0);
  return <><main className="simple-page"><h1>{t("title")}</h1><p>{readiness.probability === null ? t("empty") : t("readiness", { level: readiness.level, confidence: readinessConfidence(attempts.length, answered) })}</p><dl><dt>{t("streak")}</dt><dd>{stats.streak_days}</dd><dt>{t("answered")}</dt><dd>{answered}</dd><dt>{t("simulations")}</dt><dd>{attempts.length}</dd></dl></main><TabBar active="progress" /></>;
}

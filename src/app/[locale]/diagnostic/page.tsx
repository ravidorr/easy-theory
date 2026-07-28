import { redirect } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase";
import { getTopics, getQuestionsForTopic } from "@/lib/db";
import { localizeQuestion } from "@/lib/content-locale";
import { getLocale, getTranslations } from "next-intl/server";
import { featureEnabled } from "@/lib/feature-flags";
import { TabBar } from "@/components/TabBar";
import styles from "./page.module.css";

export default async function DiagnosticPage() {
  const supabase = await createClient();
  const [{ data: { user } }, topics] = await Promise.all([supabase.auth.getUser(), getTopics(supabase)]);
  const locale = await getLocale();
  if (!featureEnabled("guest_diagnostic", user?.id ?? "guest")) redirect(`/${locale}/auth/login`);
  const t = await getTranslations("Diagnostic");
  const questionGroups = await Promise.all(topics.map(async (topic) => ({
    topic,
    questions: (await getQuestionsForTopic(supabase, topic.id)).slice(0, 3),
  })));
  const questions = questionGroups.flatMap(({ questions: group }) => group).slice(0, 12);
  if (questions.length !== 12) redirect(`/${locale}/auth/login`);
  const localizedQuestions = questions.map((question) => ({
    ...question,
    ...localizeQuestion(locale, question as unknown as Record<string, unknown>),
  }));
  return (
    <>
    <main id="diagnostic" data-authenticated={user ? "true" : "false"} className={styles.page}>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <label htmlFor="diagnostic-target-date">{t("targetDate")}</label>
      <input id="diagnostic-target-date" type="date" />
      <form id="diagnostic-form">
        {localizedQuestions.map((question, index) => (
          <fieldset key={question.id} data-question-id={question.id}>
            <legend>{t("question", { current: index + 1, total: localizedQuestions.length })}: {question.question_display}</legend>
            {(["a", "b", "c", "d"] as const).map((option) => (
              <label key={option}>
                <input type="radio" name={question.id} value={option} required />
                {(question as unknown as Record<string, string>)[`option_${option}_display`]}
              </label>
            ))}
          </fieldset>
        ))}
        <button type="submit" className="btn-primary">{t("submit")}</button>
      </form>
      <div id="diagnostic-result" role="status" aria-live="polite" hidden />
    </main>
    <TabBar active="practice" current={null} />
    <Script src="/js/diagnostic.js" strategy="afterInteractive" />
    </>
  );
}

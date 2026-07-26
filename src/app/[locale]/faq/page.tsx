import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getLatestSourceRelease } from "@/lib/db";
import { OFFICIAL_QUESTION_BANK_URL } from "@/lib/source-release";

const FAQ = [
  ["מאיפה מגיעות השאלות?", "השאלות מבוססות על מאגר השאלות והתשובות הרשמי של משרד התחבורה והבטיחות בדרכים."],
  ["איך יודעים מה לתרגל?", "האבחון והתרגול מזהים נושאים שדורשים חזרה ומציעים את הצעד הבא."],
  ["האם ציון המוכנות מבטיח מעבר?", "לא. זו הערכת מוכנות שמתארת את הראיות שנצברו באפליקציה, ולא תחזית או הבטחת מעבר."],
];
export const metadata: Metadata = { title: "שאלות נפוצות על לימוד תאוריה", description: "תשובות על מאגר השאלות, תרגול ומוכנות למבחן התיאוריה.", alternates: { canonical: "/he/faq" } };
export default async function FaqPage() {
  const source = await getLatestSourceRelease(await createClient());
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) };
  return <main className="simple-page" lang="he"><h1>שאלות נפוצות על לימוד תיאוריה</h1>{FAQ.map(([question, answer]) => <section key={question}><h2>{question}</h2><p>{answer}</p></section>)}<Link className="btn-primary" href="/diagnostic">לאבחון קצר</Link><p><a href={OFFICIAL_QUESTION_BANK_URL}>מאגר השאלות הרשמי של משרד התחבורה</a></p>{source && <p>עדכון המאגר מתועד בכל גרסת ייבוא.</p>}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></main>;
}

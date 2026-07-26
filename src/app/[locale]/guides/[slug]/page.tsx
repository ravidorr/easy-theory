import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getLatestSourceRelease } from "@/lib/db";
import { formatSourceRelease, OFFICIAL_QUESTION_BANK_URL } from "@/lib/source-release";

const GUIDES: Record<string, { title: string; answer: string; explanation: string; confusion: string }> = {
  signs: {
    title: "תמרורי דרך: איך לומדים נכון למבחן התיאוריה",
    answer: "תמרור הוא הוראה או אזהרה שיש לפרש לפי צורתו, צבעו והקשר הדרך.",
    explanation: "כדאי לתרגל זיהוי של המשמעות לפני שינון מספר התמרור, ואז לבדוק את ההסבר המלא בשאלה.",
    confusion: "הבלבול הנפוץ הוא בין תמרורי אזהרה, הוריה ואיסור בעלי צבעים דומים.",
  },
  "traffic-laws": {
    title: "חוקי תנועה למבחן התיאוריה",
    answer: "חוקי התנועה מגדירים את כללי הדרך, זכות הקדימה והפעולות המותרות לנהג.",
    explanation: "לומדים כלל, בוחנים תרחיש, ואז מתרגלים שאלות דומות עד שניתן להסביר את ההחלטה.",
    confusion: "תשובה שנשמעת הגיונית אינה בהכרח הכלל המחייב; יש להיעזר בנוסח ובהסבר של המאגר הרשמי.",
  },
  safety: {
    title: "בטיחות בדרכים למבחן התיאוריה",
    answer: "נהיגה בטוחה מותאמת לתנאי הדרך, הראות, המהירות והסיכון למשתמשי דרך אחרים.",
    explanation: "תרגול איכותי מחבר בין הכלל לבין מצב אמיתי, למשל מרחק עצירה בכביש רטוב.",
    confusion: "אל תחליפו כלל בטיחות בהנחת יסוד על מה שנהגים אחרים יעשו.",
  },
  vehicle: {
    title: "הכרת הרכב למבחן התיאוריה",
    answer: "הכרת הרכב עוסקת במערכות שמשפיעות על שליטה, תחזוקה ובטיחות.",
    explanation: "מומלץ לחזור על מונחים ועל פעולות הבדיקה, ואז לפתור שאלות יישום.",
    confusion: "שינוי ברכב או טיפול בו מחייבים את התנאים והאישורים המפורטים בשאלה ובמקור הרשמי.",
  },
};

export function generateStaticParams() { return Object.keys(GUIDES).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const guide = GUIDES[slug];
  return guide ? { title: guide.title, description: guide.answer, alternates: { canonical: `/he/guides/${slug}` } } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = GUIDES[slug]; if (!guide) notFound();
  const source = await getLatestSourceRelease(await createClient());
  return <main className="simple-page" lang="he"><nav aria-label="פירורי לחם"><Link href="/">לימוד תיאוריה</Link> / {guide.title}</nav><h1>{guide.title}</h1><p><strong>{guide.answer}</strong></p><h2>הסבר פשוט</h2><p>{guide.explanation}</p><h2>טעות נפוצה</h2><p>{guide.confusion}</p><Link className="btn-primary" href={`/topics/${slug}`}>תרגול שאלות בנושא</Link><p><a href={OFFICIAL_QUESTION_BANK_URL}>מקור: מאגר השאלות הרשמי של משרד התחבורה</a></p>{source && <p>{formatSourceRelease(source, "he")}</p>}</main>;
}

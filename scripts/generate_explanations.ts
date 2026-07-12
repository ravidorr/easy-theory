import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = 10;

type Question = {
  id: string;
  question_number: number;
  question_he: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
};

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function generateExplanation(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  q: Question
): Promise<string> {
  const optionMap = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
  const correctAnswer = optionMap[q.correct_option];
  const prompt = `אתה עוזר לימוד לנהיגה בישראל. כתוב הסבר קצר בעברית (2-3 משפטים) לשאלה הבאה:\n\nשאלה: ${q.question_he}\nתשובה נכונה: ${correctAnswer}\n\nכתוב הסבר ברור ותמציתי שמסביר מדוע התשובה נכונה.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function processQuestion(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  supabase: ReturnType<typeof createClient>,
  q: Question,
  idx: number,
  total: number
): Promise<void> {
  try {
    const explanation = await generateExplanation(model, q);
    if (DRY_RUN) {
      console.log(`[${idx}/${total}] Q#${q.question_number} — ${explanation} [DRY RUN]`);
      return;
    }
    const { error } = await supabase.from("questions").update({ explanation_he: explanation }).eq("id", q.id);
    if (error) {
      console.error(`[${idx}/${total}] Q#${q.question_number} — update failed: ${error.message}`);
    } else {
      console.log(`[${idx}/${total}] Q#${q.question_number} — done`);
    }
  } catch (err) {
    console.error(`[${idx}/${total}] Q#${q.question_number} — error: ${err}`);
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!geminiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const genai = new GoogleGenerativeAI(geminiKey);
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

  let allQuestions: Question[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, question_number, question_he, option_a, option_b, option_c, option_d, correct_option")
      .or("explanation_he.is.null,explanation_he.eq.")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Failed to fetch questions:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allQuestions = allQuestions.concat(data as Question[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const total = allQuestions.length;
  if (total === 0) {
    console.log("No questions need explanations.");
    return;
  }

  console.log(`Found ${total} questions without explanations.${DRY_RUN ? " [DRY RUN]" : ""}`);

  const batches = chunk(allQuestions, CONCURRENCY);
  let processed = 0;

  for (const batch of batches) {
    await Promise.all(
      batch.map((q) => processQuestion(model, supabase, q, ++processed, total))
    );
  }

  console.log(`Done. Processed ${total} questions.`);
}

main();

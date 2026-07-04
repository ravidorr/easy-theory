import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 2000;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateExplanation(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  q: Question
): Promise<string> {
  const optionMap = {
    a: q.option_a,
    b: q.option_b,
    c: q.option_c,
    d: q.option_d,
  };
  const correctAnswer = optionMap[q.correct_option];

  const prompt = `אתה עוזר לימוד לנהיגה בישראל. כתוב הסבר קצר בעברית (2-3 משפטים) לשאלה הבאה:\n\nשאלה: ${q.question_he}\nתשובה נכונה: ${correctAnswer}\n\nכתוב הסבר ברור ותמציתי שמסביר מדוע התשובה נכונה.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  if (!geminiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const genai = new GoogleGenerativeAI(geminiKey);
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, correct_option")
    .or("explanation_he.is.null,explanation_he.eq.");

  if (error) {
    console.error("Failed to fetch questions:", error.message);
    process.exit(1);
  }

  if (!questions || questions.length === 0) {
    console.log("No questions need explanations.");
    return;
  }

  const total = questions.length;
  console.log(`Found ${total} questions without explanations.${DRY_RUN ? " [DRY RUN]" : ""}`);

  const batches = chunk(questions as Question[], BATCH_SIZE);
  let processed = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    for (const q of batch) {
      processed++;
      try {
        const explanation = await generateExplanation(model, q);

        if (DRY_RUN) {
          console.log(`[${processed}/${total}] Q#${q.question_number} — ${explanation} [DRY RUN]`);
        } else {
          const { error: updateError } = await supabase
            .from("questions")
            .update({ explanation_he: explanation })
            .eq("id", q.id);

          if (updateError) {
            console.error(`[${processed}/${total}] Q#${q.question_number} — update failed: ${updateError.message}`);
          } else {
            console.log(`[${processed}/${total}] Q#${q.question_number} — done`);
          }
        }
      } catch (err) {
        console.error(`[${processed}/${total}] Q#${q.question_number} — error: ${err}`);
      }
    }

    if (batchIdx < batches.length - 1) {
      console.log(`Batch ${batchIdx + 1}/${batches.length} complete. Waiting ${BATCH_DELAY_MS}ms...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`Done. Processed ${processed} questions.`);
}

main();

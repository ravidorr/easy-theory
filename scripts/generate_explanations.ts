import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
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
  source_release_id: string | null;
};

type ExplanationDraft = {
  questionNumber: number;
  locale: "he";
  explanation: string;
  sourceUrl: string;
  sourceChecksum: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function generateExplanation(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  q: Question,
  sourceUrl: string
): Promise<string> {
  const optionMap = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
  const correctAnswer = optionMap[q.correct_option];
  const prompt = `אתה עוזר לימוד לנהיגה בישראל. כתוב טיוטת הסבר קצר בעברית (2-3 משפטים) לשאלה הבאה. הסתמך רק על מקור זה: ${sourceUrl}\n\nשאלה: ${q.question_he}\nתשובה נכונה: ${correctAnswer}\n\nאל תציג את הטיוטה כמאושרת ואל תוסיף עובדות שאינן נתמכות במקור.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function main() {
  if (args.length !== 2 || args[0] !== "--output") {
    throw new Error("usage: pnpm generate-explanations -- --output <drafts.json>");
  }
  if (!outputPath || outputPath.startsWith("--")) {
    throw new Error("refusing to write explanations: provide --output <drafts.json>");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, correct_option, source_release_id")
    .eq("is_active", true)
    .not("source_release_id", "is", null)
    .or("explanation_he.is.null,explanation_he.eq.");
  if (error) throw new Error(`Failed to fetch questions: ${error.message}`);

  const allQuestions = (questions ?? []) as Question[];
  const releaseIds = [...new Set(allQuestions.map((q) => q.source_release_id).filter((id): id is string => id != null))];
  const { data: releases, error: releasesError } = await supabase
    .from("content_source_releases")
    .select("id, resource_url, source_checksum, source_kind")
    .in("id", releaseIds);
  if (releasesError) throw new Error(`Failed to fetch question sources: ${releasesError.message}`);
  const sources = new Map((releases ?? []).map((release) => [release.id, release]));
  const missingSource = allQuestions.find((q) => {
    const source = q.source_release_id ? sources.get(q.source_release_id) : null;
    return !source || source.source_kind !== "question_bank" || !/^https:\/\//.test(source.resource_url);
  });
  if (missingSource) throw new Error(`Question ${missingSource.question_number} has no pinned Ministry source record`);
  if (!allQuestions.length) {
    console.log("No source-backed questions need explanation drafts.");
    return;
  }

  const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: "gemini-2.5-flash" });
  const drafts: ExplanationDraft[] = [];
  for (const batch of chunk(allQuestions, CONCURRENCY)) {
    const generated = await Promise.all(batch.map(async (q) => {
      const source = sources.get(q.source_release_id!)!;
      return {
        questionNumber: q.question_number,
        locale: "he" as const,
        explanation: await generateExplanation(model, q, source.resource_url),
        sourceUrl: source.resource_url,
        sourceChecksum: source.source_checksum,
      };
    }));
    drafts.push(...generated);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ version: 1, drafts }, null, 2)}\n`);
  console.log(`Wrote ${drafts.length} cited explanation drafts to ${outputPath}. Human review is required before publication.`);
}

void main().catch((error) => {
  console.error(`generate-explanations: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

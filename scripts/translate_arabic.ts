/**
 * One-time script: translate Hebrew DB content to Arabic using Gemini.
 *
 * Usage:
 *   pnpm translate-arabic            # translate everything missing
 *   pnpm translate-arabic --dry-run  # preview without writing
 *   pnpm translate-arabic --table topics
 *   pnpm translate-arabic --table questions
 *   pnpm translate-arabic --table signs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

type AnySupabase = ReturnType<typeof createClient>;
type GeminiModel = ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>;

// Row types — defined here because _ar columns don't exist in generated types yet
type TopicRow = { id: string; name_he: string; description_he: string | null };
type QuestionRow = {
  id: string; question_number: number;
  question_he: string; option_a: string; option_b: string; option_c: string; option_d: string;
  explanation_he: string | null;
};
type SignRow = { id: string; sign_number: string; name_he: string; meaning_he: string | null };

const DRY_RUN = process.argv.includes("--dry-run");
const TABLE_ARG = (() => {
  const idx = process.argv.indexOf("--table");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();
const LIMIT_ARG = (() => {
  const idx = process.argv.indexOf("--limit");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : null;
})();

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Gemini translation helper (with retry) ────────────────────────────────

async function translateBatch(
  model: GeminiModel,
  items: Record<string, string>[],
  context: string,
  attempt = 1
): Promise<Record<string, string>[]> {
  const prompt = `You are a professional translator specialising in Israeli road traffic law. Translate the Hebrew values in the following JSON into Modern Standard Arabic (MSA). Keep technical road-sign and traffic terminology accurate. Return ONLY a valid JSON array — preserve all keys exactly as-is, only replace the Hebrew string values with their Arabic translations. The "id" field must be copied unchanged. Do not add any explanation or markdown.

Context: ${context}

Input:
${JSON.stringify(items, null, 2)}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    // Strip markdown fences
    let json = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "");
    // Extract just the JSON array if there's surrounding prose
    const arrayMatch = json.match(/\[[\s\S]*\]/);
    if (arrayMatch) json = arrayMatch[0];
    return JSON.parse(json) as Record<string, string>[];
  } catch (err) {
    if (attempt >= 4) throw err;
    const delay = attempt * 3000;
    console.warn(`  translateBatch attempt ${attempt} failed, retrying in ${delay}ms… (${err})`);
    await sleep(delay);
    return translateBatch(model, items, context, attempt + 1);
  }
}

// ── Topics ─────────────────────────────────────────────────────────────────

async function translateTopics(supabase: AnySupabase, model: GeminiModel) {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name_he, description_he")
    .or("name_ar.is.null,name_ar.eq.");

  if (error) { console.error("topics fetch:", error.message); return; }
  if (!data?.length) { console.log("topics: nothing to translate"); return; }
  const rows = data as unknown as TopicRow[];

  console.log(`topics: ${rows.length} rows to translate${DRY_RUN ? " [DRY RUN]" : ""}`);

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const inputs = batch.map((r) => ({
      id: r.id,
      name_ar: r.name_he ?? "",
      description_ar: r.description_he ?? "",
    }));

    const translated = await translateBatch(model, inputs, "Topic names and descriptions for driving theory categories");

    for (const row of translated) {
      const original = batch.find((r) => r.id === row.id);
      if (!original) { console.warn(`  ⚠ topic: unknown id ${row.id} (Gemini mangled it, skipping)`); continue; }
      if (DRY_RUN) {
        console.log(`  [topic] ${original.name_he} → ${row.name_ar}`);
        continue;
      }
      const { error: upErr } = await supabase
        .from("topics")
                .update({ name_ar: row.name_ar || null, description_ar: row.description_ar || null })
        .eq("id", row.id);
      if (upErr) console.error(`  topic ${row.id}: ${upErr.message}`);
      else console.log(`  ✓ topic: ${original.name_he}`);
    }

    await sleep(BATCH_DELAY_MS);
  }
}

// ── Questions ──────────────────────────────────────────────────────────────

async function translateQuestions(supabase: AnySupabase, model: GeminiModel) {
  let query = supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, explanation_he")
    .or("question_ar.is.null,question_ar.eq.");
  if (LIMIT_ARG) query = query.limit(LIMIT_ARG);
  const { data, error } = await query;

  if (error) { console.error("questions fetch:", error.message); return; }
  if (!data?.length) { console.log("questions: nothing to translate"); return; }
  const rows = data as unknown as QuestionRow[];

  console.log(`questions: ${rows.length} rows to translate${DRY_RUN ? " [DRY RUN]" : ""}`);

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const inputs = batch.map((r) => ({
      id: r.id,
      question_ar:    r.question_he    ?? "",
      option_a_ar:    r.option_a       ?? "",
      option_b_ar:    r.option_b       ?? "",
      option_c_ar:    r.option_c       ?? "",
      option_d_ar:    r.option_d       ?? "",
      explanation_ar: r.explanation_he ?? "",
    }));

    const translated = await translateBatch(
      model,
      inputs,
      "Driving theory exam questions and multiple-choice answer options. Keep answer options concise."
    );

    for (const row of translated) {
      const original = rows.find((r) => r.id === row.id);
      if (!original) { console.warn(`  ⚠ question: unknown id ${row.id} (Gemini mangled it, skipping)`); continue; }
      if (DRY_RUN) {
        console.log(`  [q#${original.question_number}] ${original.question_he.slice(0, 40)}… → ${row.question_ar?.slice(0, 40)}…`);
        continue;
      }
      const { error: upErr } = await supabase
        .from("questions")
                .update({
          question_ar:    row.question_ar    || null,
          option_a_ar:    row.option_a_ar    || null,
          option_b_ar:    row.option_b_ar    || null,
          option_c_ar:    row.option_c_ar    || null,
          option_d_ar:    row.option_d_ar    || null,
          explanation_ar: row.explanation_ar || null,
        })
        .eq("id", row.id);
      if (upErr) console.error(`  question ${row.id}: ${upErr.message}`);
      else console.log(`  ✓ q#${original.question_number}`);
    }

    await sleep(BATCH_DELAY_MS);
  }
}

// ── Signs ──────────────────────────────────────────────────────────────────

async function translateSigns(supabase: AnySupabase, model: GeminiModel) {
  const { data, error } = await supabase
    .from("signs")
    .select("id, sign_number, name_he, meaning_he")
    .or("name_ar.is.null,name_ar.eq.");

  if (error) { console.error("signs fetch:", error.message); return; }
  if (!data?.length) { console.log("signs: nothing to translate"); return; }
  const rows = data as unknown as SignRow[];

  console.log(`signs: ${rows.length} rows to translate${DRY_RUN ? " [DRY RUN]" : ""}`);

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const inputs = batch.map((r) => ({
      id: r.id,
      name_ar:    r.name_he    ?? "",
      meaning_ar: r.meaning_he ?? "",
    }));

    const translated = await translateBatch(
      model,
      inputs,
      "Israeli road sign names and their meanings. Use standard Arabic road-sign terminology."
    );

    for (const row of translated) {
      const original = batch.find((r) => r.id === row.id);
      if (!original) { console.warn(`  ⚠ sign: unknown id ${row.id} (Gemini mangled it, skipping)`); continue; }
      if (DRY_RUN) {
        console.log(`  [sign ${original.sign_number}] ${original.name_he} → ${row.name_ar}`);
        continue;
      }
      const { error: upErr } = await supabase
        .from("signs")
                .update({ name_ar: row.name_ar || null, meaning_ar: row.meaning_ar || null })
        .eq("id", row.id);
      if (upErr) console.error(`  sign ${row.id}: ${upErr.message}`);
      else console.log(`  ✓ sign ${original.sign_number}: ${original.name_he}`);
    }

    await sleep(BATCH_DELAY_MS);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

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
  const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: "gemini-2.5-flash" });

  const run = TABLE_ARG;
  if (!run || run === "topics")    await translateTopics(supabase, model);
  if (!run || run === "questions") await translateQuestions(supabase, model);
  if (!run || run === "signs")     await translateSigns(supabase, model);

  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string)
    .getGenerativeModel({ model: "gemini-2.5-flash" });

  const ids = [
    "5c78e391-a6cc-4552-9ba7-9170ed7dd177",
    "4f5ec3f6-354a-45f2-8092-d4d6047f4e75",
    "1cb5667c-1f84-432f-b708-9081dd40dff0",
  ];

  const { data, error } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, explanation_he")
    .in("id", ids);

  if (error || !data) { console.error(error); return; }

  for (const q of data) {
    const prompt = `Translate all Hebrew text values to Modern Standard Arabic (MSA). Road traffic / driving theory context. Return ONLY valid JSON, no markdown.

Input:
${JSON.stringify({
  id: q.id,
  question_ar: q.question_he ?? "",
  option_a_ar: q.option_a ?? "",
  option_b_ar: q.option_b ?? "",
  option_c_ar: q.option_c ?? "",
  option_d_ar: q.option_d ?? "",
  explanation_ar: q.explanation_he ?? "",
}, null, 2)}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    let json = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "");
    const objMatch = json.match(/\{[\s\S]*\}/);
    if (objMatch) json = objMatch[0];
    const row = JSON.parse(json);

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
      .eq("id", q.id);

    if (upErr) console.error(`  q#${q.question_number}: ${upErr.message}`);
    else console.log(`  ✓ q#${q.question_number}: ${q.question_he.slice(0, 50)}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

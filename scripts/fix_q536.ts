import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string)
    .getGenerativeModel({ model: "gemini-2.5-flash" });

  const { data } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, explanation_he")
    .eq("id", "5c78e391-a6cc-4552-9ba7-9170ed7dd177")
    .single();

  if (!data) { console.error("not found"); return; }

  console.log("Translating:", data.question_he);

  const prompt = `Translate each Hebrew string to Modern Standard Arabic (MSA). Israeli road traffic context. Return ONLY a raw JSON object (no markdown, no code fences). Keys: question_ar, option_a_ar, option_b_ar, option_c_ar, option_d_ar, explanation_ar.

question_he: ${data.question_he}
option_a: ${data.option_a}
option_b: ${data.option_b}
option_c: ${data.option_c}
option_d: ${data.option_d}
explanation_he: ${data.explanation_he ?? ""}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
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
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq("id", data.id);

      if (upErr) console.error(`DB error: ${upErr.message}`);
      else console.log(`✓ q#${data.question_number} translated`);
      return;
    } catch (err) {
      console.warn(`  attempt ${attempt} failed: ${err}`);
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }
  console.error("All attempts failed");
}

main().catch((err) => { console.error(err); process.exit(1); });

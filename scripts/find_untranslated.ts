import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data, error } = await s
    .from("questions")
    .select("id, question_number, question_he")
    .or("question_ar.is.null,question_ar.eq.")
    .order("question_number");
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
main();

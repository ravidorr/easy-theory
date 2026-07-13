import { createClient } from "@supabase/supabase-js";
async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const checks = [
    { table: "topics",    col: "name_ar" },
    { table: "questions", col: "question_ar" },
    { table: "signs",     col: "name_ar" },
  ] as const;
  for (const { table, col } of checks) {
    const [{ count: total }, { count: done }] = await Promise.all([
      s.from(table).select("*", { count: "exact", head: true }),
      s.from(table).select("*", { count: "exact", head: true }).not(col, "is", null).neq(col, ""),
    ]);
    console.log(`${table}: ${done} / ${total}`);
  }
}
main();

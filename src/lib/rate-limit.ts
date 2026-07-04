import { SupabaseClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data } = await supabase.rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return data === true;
}

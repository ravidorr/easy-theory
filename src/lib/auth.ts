import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

/**
 * Require a signed-in learner in a Server Component.
 *
 * Callers provide the complete login URL so page-specific return targets keep
 * their existing encoding and query-string behavior.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
  loginHref: string
): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(loginHref);

  return user;
}

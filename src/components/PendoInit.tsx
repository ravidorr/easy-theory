import Script from "next/script";
import { reportError } from "@/lib/monitoring";
import { getPendoVisitor } from "@/lib/pendo";
import { createClient } from "@/lib/supabase";

type InitOptions =
  | { visitor: Record<string, unknown> }
  | { visitor: { id: "" }; forceAnonymous: true };

// Anything that is not a confirmed, signed-in learner starts anonymous and
// ignores an identified visitor the SDK persisted from a previous learner.
const ANONYMOUS: InitOptions = { visitor: { id: "" }, forceAnonymous: true };

// The SDK restores a persisted identified visitor on initialize, even for an
// empty `visitor.id`. Cookies cannot say whether a session is still valid (an
// expired token and a PKCE code-verifier cookie both look signed in), so the
// decision comes from a verified getUser() result, and initialize only runs
// after it. Until then the snippet's stub queues calls and sends nothing.
async function getInitOptions(): Promise<InitOptions> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return ANONYMOUS;

    try {
      return { visitor: { ...(await getPendoVisitor(supabase, user)) } };
    } catch (error) {
      // Analytics must never take down the page it is measuring. The learner is
      // still verified, so identify them by id alone rather than as a stranger.
      reportError("pendo", "visitor lookup failed", error);
      return { visitor: { id: user.id } };
    }
  } catch (error) {
    reportError("pendo", "session lookup failed", error);
    return ANONYMOUS;
  }
}

export async function PendoInit() {
  const options = await getInitOptions();

  // The email is learner-supplied; escaping "<" keeps it from ever closing a
  // script element.
  const payload = JSON.stringify(options).replace(/</g, "\\u003c");

  return (
    <Script id="pendo-init" strategy="afterInteractive">
      {`pendo.initialize(${payload});`}
    </Script>
  );
}

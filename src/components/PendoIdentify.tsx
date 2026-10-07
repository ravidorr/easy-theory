import Script from "next/script";
import { reportError } from "@/lib/monitoring";
import { getPendoVisitor, type PendoVisitor } from "@/lib/pendo";
import { createClient } from "@/lib/supabase";

// Runs on every page that has no signed-in learner: the login page after a
// logout or an expired session, and public pages. The snippet stub has no
// clearSession, so wait for the agent. A learner who is already anonymous is
// left alone, otherwise every public page view would mint a new anonymous
// visitor.
const PENDO_RESET_SCRIPT = `
(function () {
  var attempts = 0;
  var timer = setInterval(function () {
    var p = window.pendo;
    if (p && typeof p.clearSession === 'function' && typeof p.isAnonymousVisitor === 'function') {
      clearInterval(timer);
      if (!p.isAnonymousVisitor()) p.clearSession();
    } else if (++attempts >= 200) {
      clearInterval(timer);
    }
  }, 100);
})();
`;

type SignedInState =
  | { status: "signed-in"; visitor: PendoVisitor }
  | { status: "signed-out" }
  | { status: "unknown" };

// A transient auth outage says nothing about who is signed in, so it must not
// clear an identity that may still be valid.
function isTransientAuthError(error: { name?: string; status?: number } | null | undefined) {
  if (!error) return false;
  return (
    error.name === "AuthRetryableFetchError" ||
    (typeof error.status === "number" && error.status >= 500)
  );
}

async function getSignedInState(): Promise<SignedInState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!user) {
      return isTransientAuthError(error) ? { status: "unknown" } : { status: "signed-out" };
    }
    return { status: "signed-in", visitor: await getPendoVisitor(supabase, user) };
  } catch (error) {
    // Analytics must never take down the page it is measuring.
    reportError("pendo", "visitor lookup failed", error);
    return { status: "unknown" };
  }
}

export async function PendoIdentify() {
  const state = await getSignedInState();
  if (state.status === "unknown") return null;

  if (state.status === "signed-out") {
    return (
      <Script id="pendo-reset" strategy="afterInteractive">
        {PENDO_RESET_SCRIPT}
      </Script>
    );
  }

  // The email is learner-supplied; escaping "<" keeps it from ever closing a
  // script element.
  const payload = JSON.stringify({ visitor: state.visitor }).replace(/</g, "\\u003c");

  return (
    <Script id="pendo-identify" strategy="afterInteractive">
      {`pendo.identify(${payload});`}
    </Script>
  );
}

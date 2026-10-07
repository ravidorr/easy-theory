import Script from "next/script";
import { reportError } from "@/lib/monitoring";
import { getPendoVisitor, type PendoVisitor } from "@/lib/pendo";
import { createClient } from "@/lib/supabase";

async function getSignedInVisitor(): Promise<PendoVisitor | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? await getPendoVisitor(supabase, user) : null;
  } catch (error) {
    // Analytics must never take down the page it is measuring.
    reportError("pendo", "visitor lookup failed", error);
    return null;
  }
}

export async function PendoIdentify() {
  const visitor = await getSignedInVisitor();
  if (!visitor) return null;

  // The email is learner-supplied; escaping "<" keeps it from ever closing a
  // script element.
  const payload = JSON.stringify({ visitor }).replace(/</g, "\\u003c");

  return (
    <Script id="pendo-identify" strategy="afterInteractive">
      {`pendo.identify(${payload});`}
    </Script>
  );
}

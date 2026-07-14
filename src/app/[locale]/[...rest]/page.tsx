import { notFound } from "next/navigation";

// Catch-all for unmatched paths under a valid locale, so the localized
// not-found boundary renders inside the locale layout.
export default function CatchAllPage() {
  notFound();
}

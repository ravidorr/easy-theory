import type { PendoTrackProperties } from "./pendo";

const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const TRACK_TIMEOUT_MS = 3000;
// Learners are individuals; the app has no account concept to report.
const PENDO_ACCOUNT_ID = "system";

// Server-side Track Event API. Silent unless PENDO_TRACK_EVENT_SECRET is set,
// so dev, QA and CI never send events. Never throws, and failures are only
// logged: an analytics outage must not burn the error tracker's quota.
export async function trackServerEvent(
  event: string,
  visitorId: string,
  properties: PendoTrackProperties
): Promise<void> {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) return;

  try {
    const response = await fetch(PENDO_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": secret,
      },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId: PENDO_ACCOUNT_ID,
        timestamp: Date.now(),
        properties,
      }),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[pendo] track ${event} failed:`, response.status);
    }
  } catch (error) {
    console.warn(`[pendo] track ${event} failed:`, error);
  }
}

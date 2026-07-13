/**
 * Parse a request body as a JSON object, returning null instead of throwing
 * on malformed JSON or non-object payloads so routes can respond 400.
 */
export async function parseJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

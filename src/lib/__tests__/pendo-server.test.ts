import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackServerEvent } from "../pendo-server";

const NOW = new Date("2026-07-30T05:00:00Z");

describe("trackServerEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.PENDO_TRACK_EVENT_SECRET;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends nothing when the integration secret is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("user_signed_in", "u1", { auth_flow: "pkce" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a track event for the visitor with the secret from the environment", async () => {
    process.env.PENDO_TRACK_EVENT_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("study_reminder_sent", "u1", { channel: "push", duration_minutes: 45 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://data.pendo.io/data/track",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pendo-integration-key": "test-secret",
        },
        signal: expect.any(AbortSignal),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      type: "track",
      event: "study_reminder_sent",
      visitorId: "u1",
      accountId: "system",
      timestamp: NOW.getTime(),
      properties: { channel: "push", duration_minutes: 45 },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("logs a rejected request without throwing", async () => {
    process.env.PENDO_TRACK_EVENT_SECRET = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(trackServerEvent("user_signed_in", "u1", {})).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith("[pendo] track user_signed_in failed:", 400);
  });

  it("logs a network failure without throwing", async () => {
    process.env.PENDO_TRACK_EVENT_SECRET = "test-secret";
    const error = new Error("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));

    await expect(trackServerEvent("user_signed_in", "u1", {})).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith("[pendo] track user_signed_in failed:", error);
  });
});

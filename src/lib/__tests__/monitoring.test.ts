import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportError } from "../monitoring";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const mockCapture = vi.mocked(Sentry.captureException);

describe("reportError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs with the established [area] message: console format", () => {
    const error = new Error("boom");
    reportError("quiz", "SRS update failed", error);
    expect(console.error).toHaveBeenCalledWith(
      "[quiz] SRS update failed:",
      error
    );
  });

  it("appends context to the console output when provided", () => {
    const error = new Error("boom");
    reportError("quiz", "submission failed", error, { ref: "abc123" });
    expect(console.error).toHaveBeenCalledWith(
      "[quiz] submission failed:",
      error,
      { ref: "abc123" }
    );
  });

  it("forwards Error instances to the tracker unchanged, tagged by area", () => {
    const error = new Error("boom");
    reportError("schedule", "replace failed", error, { userId: "u1" });
    expect(mockCapture).toHaveBeenCalledWith(error, {
      tags: { area: "schedule" },
      extra: { message: "[schedule] replace failed", userId: "u1" },
    });
  });

  it("wraps non-Error values with a message extracted from .message", () => {
    const pgError = { message: "duplicate key", code: "23505" };
    reportError("srs", "upsert failed", pgError);
    const [exception] = mockCapture.mock.calls[0];
    expect(exception).toBeInstanceOf(Error);
    expect((exception as Error).message).toBe(
      "[srs] upsert failed: duplicate key"
    );
    expect((exception as Error).cause).toBe(pgError);
  });

  it("stringifies non-Error values without a usable .message", () => {
    reportError("push", "send failed", "timeout");
    const [exception] = mockCapture.mock.calls[0];
    expect((exception as Error).message).toBe("[push] send failed: timeout");
  });

  it("stringifies objects whose .message is not a string", () => {
    reportError("push", "send failed", { message: 42 });
    const [exception] = mockCapture.mock.calls[0];
    expect((exception as Error).message).toBe(
      "[push] send failed: [object Object]"
    );
  });
});

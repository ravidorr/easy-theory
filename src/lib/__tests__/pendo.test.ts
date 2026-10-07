import { afterEach, describe, expect, it, vi } from "vitest";
import { trackPendoEvent } from "../pendo";

afterEach(() => {
  delete window.pendo;
});

describe("trackPendoEvent", () => {
  it("forwards the event and properties to the Pendo agent", () => {
    const track = vi.fn();
    window.pendo = { track };

    trackPendoEvent("contact_message_sent", { topic: "bug", message_length: 12 });

    expect(track).toHaveBeenCalledWith("contact_message_sent", { topic: "bug", message_length: 12 });
  });

  it("does nothing when the agent is missing or has no track method", () => {
    expect(() => trackPendoEvent("app_error_shown", { error_boundary: "root" })).not.toThrow();
    window.pendo = {};
    expect(() => trackPendoEvent("app_error_shown", { error_boundary: "root" })).not.toThrow();
  });

  it("swallows errors thrown by the agent", () => {
    window.pendo = {
      track: () => {
        throw new Error("agent failure");
      },
    };

    expect(() => trackPendoEvent("app_error_shown", { error_boundary: "locale" })).not.toThrow();
  });
});

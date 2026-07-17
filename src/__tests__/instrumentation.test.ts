import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
}));

const mockInit = vi.mocked(Sentry.init);

describe("instrumentation (server + client GlitchTip init)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("register() initialises the SDK with the DSN and errors-only settings", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLITCHTIP_DSN", "https://key@glitchtip.example/1");
    vi.stubEnv("NODE_ENV", "production");
    const { register } = await import("@/instrumentation");
    register();
    expect(mockInit).toHaveBeenCalledWith({
      dsn: "https://key@glitchtip.example/1",
      tracesSampleRate: 0,
      enabled: true,
    });
  });

  it("register() disables the SDK when no DSN is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLITCHTIP_DSN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { register } = await import("@/instrumentation");
    register();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it("register() disables the SDK outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLITCHTIP_DSN", "https://key@glitchtip.example/1");
    vi.stubEnv("NODE_ENV", "development");
    const { register } = await import("@/instrumentation");
    register();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it("exposes Sentry's request-error hook for unhandled route errors", async () => {
    const { onRequestError } = await import("@/instrumentation");
    expect(onRequestError).toBe(Sentry.captureRequestError);
  });

  it("client entry initialises the SDK on import with the same settings", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLITCHTIP_DSN", "https://key@glitchtip.example/1");
    vi.stubEnv("NODE_ENV", "production");
    await import("@/instrumentation-client");
    expect(mockInit).toHaveBeenCalledWith({
      dsn: "https://key@glitchtip.example/1",
      tracesSampleRate: 0,
      enabled: true,
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  withScope: vi.fn(),
}));

const mockInit = vi.mocked(Sentry.init);
const mockCaptureRequestError = vi.mocked(Sentry.captureRequestError);
const mockWithScope = vi.mocked(Sentry.withScope);

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

  it("tags server errors with their RSC digest before reporting them", async () => {
    const setTag = vi.fn();
    mockWithScope.mockImplementation((callback) => callback({ setTag }));
    const { onRequestError } = await import("@/instrumentation");
    const error = Object.assign(new Error("Database query failed"), {
      digest: "488860242",
    });
    const request = {
      path: "/he/more",
      method: "GET",
      headers: {},
    };
    const errorContext = {
      routerKind: "App Router" as const,
      routePath: "/[locale]/more",
      routeType: "render" as const,
      renderSource: "react-server-components" as const,
      revalidateReason: undefined,
    };

    onRequestError(error, request, errorContext);

    expect(setTag).toHaveBeenCalledWith("next.digest", "488860242");
    expect(setTag).toHaveBeenCalledWith(
      "next.render_source",
      "react-server-components"
    );
    expect(mockCaptureRequestError).toHaveBeenCalledWith(
      error,
      request,
      errorContext
    );
  });

  it("reports errors without a digest", async () => {
    const setTag = vi.fn();
    mockWithScope.mockImplementation((callback) => callback({ setTag }));
    const { onRequestError } = await import("@/instrumentation");
    const error = new Error("Route handler failed");
    const request = { path: "/api/example", method: "POST", headers: {} };
    const errorContext = {
      routerKind: "App Router" as const,
      routePath: "/api/example",
      routeType: "route" as const,
      revalidateReason: undefined,
    };

    onRequestError(error, request, errorContext);

    expect(setTag).not.toHaveBeenCalledWith(
      "next.digest",
      expect.anything()
    );
    expect(mockCaptureRequestError).toHaveBeenCalledWith(
      error,
      request,
      errorContext
    );
  });

  it("client entry initialises the SDK on import with the same settings", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLITCHTIP_DSN", "https://key@glitchtip.example/1");
    vi.stubEnv("NODE_ENV", "production");
    const { isRedactedServerComponentError } = await import("@/instrumentation-client");
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://key@glitchtip.example/1",
      tracesSampleRate: 0,
      enabled: true,
    }));

    expect(isRedactedServerComponentError({
      exception: {
        values: [{ value: "Minified React error #441; details omitted" }],
      },
    })).toBe(true);
    expect(isRedactedServerComponentError({
      exception: {
        values: [{ value: "Minified React error #419; details omitted" }],
      },
    })).toBe(true);
    expect(isRedactedServerComponentError({
      exception: { values: [{ value: "getTopicAccuracy query failed" }] },
    })).toBe(false);

    const beforeSend = mockInit.mock.calls[0]?.[0]?.beforeSend;
    const wrapperEvent = {
      exception: {
        values: [{ value: "Minified React error #441; details omitted" }],
      },
    };
    const suspenseWrapperEvent = {
      exception: {
        values: [{ value: "Minified React error #419; details omitted" }],
      },
    };
    const originalErrorEvent = {
      exception: { values: [{ value: "getTopicAccuracy query failed" }] },
    };
    expect(beforeSend?.(wrapperEvent as never, {} as never)).toBeNull();
    expect(beforeSend?.(suspenseWrapperEvent as never, {} as never)).toBeNull();
    expect(beforeSend?.(originalErrorEvent as never, {} as never)).toBe(originalErrorEvent);
  });
});

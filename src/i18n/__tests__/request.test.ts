import { describe, it, expect, vi, beforeAll } from "vitest";

type RequestConfigCallback = (opts: {
  requestLocale: Promise<string | undefined>;
}) => Promise<{ locale: string; messages: unknown }>;

let capturedCallback: RequestConfigCallback | null = null;

vi.mock("next-intl/server", () => ({
  getRequestConfig: vi.fn((cb: RequestConfigCallback) => {
    capturedCallback = cb;
    return cb;
  }),
}));

describe("i18n/request getRequestConfig callback", () => {
  beforeAll(async () => {
    await import("../request");
  });

  it("returns he locale and messages for he", async () => {
    const result = await capturedCallback!({ requestLocale: Promise.resolve("he") });
    expect(result.locale).toBe("he");
    expect(result.messages).toBeDefined();
  });

  it("returns ar locale and messages for ar", async () => {
    const result = await capturedCallback!({ requestLocale: Promise.resolve("ar") });
    expect(result.locale).toBe("ar");
    expect(result.messages).toBeDefined();
  });

  it("falls back to he for undefined locale", async () => {
    const result = await capturedCallback!({ requestLocale: Promise.resolve(undefined) });
    expect(result.locale).toBe("he");
  });

  it("falls back to he for an unrecognised locale", async () => {
    const result = await capturedCallback!({ requestLocale: Promise.resolve("fr") });
    expect(result.locale).toBe("he");
  });
});

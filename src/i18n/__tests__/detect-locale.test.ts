import { describe, it, expect } from "vitest";
import { detectLocale } from "../detect-locale";

describe("detectLocale", () => {
  it("prefers a supported cookie locale over everything else", () => {
    expect(detectLocale("ar", "he")).toBe("ar");
    expect(detectLocale("he", "ar")).toBe("he");
  });

  it("ignores an unsupported or empty cookie value", () => {
    expect(detectLocale("fr", "ar")).toBe("ar");
    expect(detectLocale("", "ar")).toBe("ar");
    expect(detectLocale(undefined, "ar")).toBe("ar");
  });

  it("matches Accept-Language entries with region subtags", () => {
    expect(detectLocale(undefined, "ar-SA,en;q=0.8")).toBe("ar");
    expect(detectLocale(undefined, "he-IL")).toBe("he");
  });

  it("respects q-value ordering regardless of listing order", () => {
    expect(detectLocale(undefined, "he;q=0.5,ar;q=0.9")).toBe("ar");
    expect(detectLocale(undefined, "en;q=1,ar;q=0.4,he;q=0.6")).toBe("he");
  });

  it("skips unsupported languages and q=0 entries", () => {
    expect(detectLocale(undefined, "en-US,en;q=0.9,ar;q=0.5")).toBe("ar");
    expect(detectLocale(undefined, "ar;q=0,he;q=0.3")).toBe("he");
  });

  it("falls back to the default locale without any usable signal", () => {
    expect(detectLocale(undefined, null)).toBe("he");
    expect(detectLocale(undefined, "")).toBe("he");
    expect(detectLocale(undefined, "en-US,fr;q=0.7")).toBe("he");
    expect(detectLocale(undefined, "*")).toBe("he");
  });

  it("is case-insensitive on language tags", () => {
    expect(detectLocale(undefined, "AR-sa")).toBe("ar");
  });

  it("tolerates optional whitespace before ; and an uppercase Q parameter", () => {
    expect(detectLocale(undefined, "ar ;q=0.9")).toBe("ar");
    expect(detectLocale(undefined, "he;Q=0.2,ar;q=0.9")).toBe("ar");
  });
});

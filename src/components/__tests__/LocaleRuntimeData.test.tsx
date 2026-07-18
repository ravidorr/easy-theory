import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LocaleRuntimeData } from "../LocaleRuntimeData";

describe("LocaleRuntimeData", () => {
  afterEach(() => {
    cleanup();
    delete window.__locale;
    delete window.__t;
    delete window.__tf;
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it("updates the legacy locale globals", () => {
    const translations = { nextBtn: "التالي", score: "{points} نقطة" };
    render(<LocaleRuntimeData locale="ar" translations={translations} theme="dark" />);

    expect(window.__locale).toBe("ar");
    expect(window.__t).toBe(translations);
    expect(window.__tf?.(translations.score, { points: 10 })).toBe("10 نقطة");
  });

  it("updates globals and theme color when the locale layout rerenders", () => {
    const { rerender } = render(
      <LocaleRuntimeData locale="he" translations={{ nextBtn: "הבא" }} theme="dark" />
    );

    rerender(
      <LocaleRuntimeData locale="ar" translations={{ nextBtn: "التالي" }} theme="light" />
    );

    expect(window.__locale).toBe("ar");
    expect(window.__t).toEqual({ nextBtn: "التالي" });
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#f5f7fc"
    );
  });
});

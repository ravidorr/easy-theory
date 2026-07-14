import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import NotFound from "../not-found";
import { getTranslations } from "next-intl/server";

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik", className: "rubik" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("NotFound (root)", () => {
  it("renders its own html element since it mounts outside the [locale] layout", async () => {
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain("<html");
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
  });

  it("resolves strings explicitly in the default locale", async () => {
    await NotFound();
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "he",
      namespace: "NotFound",
    });
  });

  it("renders the branded content with a CTA to the default-locale home", async () => {
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain("headline");
    expect(html).toContain("support");
    expect(html).toContain('href="/he"');
    expect(html).toContain('aria-label="signAlt"');
  });
});

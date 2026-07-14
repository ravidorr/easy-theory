import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import GlobalNotFound from "../global-not-found";
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

const requestCookies: Record<string, string> = {};
const requestHeaders: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      name in requestCookies ? { name, value: requestCookies[name] } : undefined,
  }),
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => requestHeaders[name.toLowerCase()] ?? null,
  }),
}));

beforeEach(() => {
  for (const store of [requestCookies, requestHeaders]) {
    for (const key of Object.keys(store)) delete store[key];
  }
});

describe("GlobalNotFound", () => {
  it("renders its own html element since it mounts outside any layout", async () => {
    const html = renderToStaticMarkup(await GlobalNotFound());
    expect(html).toContain("<html");
    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
  });

  it("resolves strings in the default locale when the request has no signal", async () => {
    await GlobalNotFound();
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "he",
      namespace: "NotFound",
    });
  });

  it("renders the branded content with a CTA to the default-locale home", async () => {
    const html = renderToStaticMarkup(await GlobalNotFound());
    expect(html).toContain("headline");
    expect(html).toContain("support");
    expect(html).toContain('href="/he"');
    expect(html).toContain('aria-label="signAlt"');
  });

  it("follows the NEXT_LOCALE cookie", async () => {
    requestCookies.NEXT_LOCALE = "ar";
    const html = renderToStaticMarkup(await GlobalNotFound());
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "ar",
      namespace: "NotFound",
    });
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('href="/ar"');
  });

  it("falls back to Accept-Language when there is no cookie", async () => {
    requestHeaders["accept-language"] = "ar-SA,ar;q=0.9,en;q=0.8";
    const html = renderToStaticMarkup(await GlobalNotFound());
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "ar",
      namespace: "NotFound",
    });
    expect(html).toContain('lang="ar"');
    expect(html).toContain('href="/ar"');
  });

  it("ignores an unsupported cookie in favor of Accept-Language", async () => {
    requestCookies.NEXT_LOCALE = "fr";
    requestHeaders["accept-language"] = "ar";
    const html = renderToStaticMarkup(await GlobalNotFound());
    expect(html).toContain('lang="ar"');
  });
});

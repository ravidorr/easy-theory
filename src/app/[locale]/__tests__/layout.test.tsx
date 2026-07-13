import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import LocaleLayout from "../layout";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik", className: "rubik" }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/script", () => ({
  default: ({ id, children }: { id?: string; children?: string }) =>
    React.createElement("script", { id }, children),
}));

vi.mock("next-intl", () => ({
  hasLocale: vi.fn((locales: string[], locale: string) => locales.includes(locale)),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("next-intl/server", () => ({
  getMessages: vi.fn().mockResolvedValue({
    JS: {
      Auth: { emailRequired: "יש להזין" },
      Quiz: { answerBtn: "צדקתי?" },
      Schedule: { saved: "נשמר!" },
      Flashcard: { done: "הושלם!" },
    },
  }),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["he", "ar"], defaultLocale: "he" },
}));

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));
vi.mock("@/app/globals.css", () => ({}));

const mockCookies = vi.mocked(cookies);

describe("LocaleLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
  });

  it("calls notFound for an unrecognised locale", async () => {
    await expect(
      LocaleLayout({
        children: React.createElement("div"),
        params: Promise.resolve({ locale: "fr" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });

  it("sets lang=he on the html element for he locale", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('lang="he"');
  });

  it("sets lang=ar on the html element for ar locale", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "ar" }),
    });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('lang="ar"');
  });

  it("always sets dir=rtl (both locales are RTL)", async () => {
    for (const locale of ["he", "ar"]) {
      const jsx = await LocaleLayout({
        children: React.createElement("div"),
        params: Promise.resolve({ locale }),
      });
      expect(renderToStaticMarkup(jsx)).toContain('dir="rtl"');
    }
  });

  it("injects window.__locale and window.__t into the inline script", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain("window.__locale");
    expect(html).toContain("window.__t");
    expect(html).toContain('"he"');
  });

  it("defaults to dark theme when no theme cookie", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    expect(renderToStaticMarkup(jsx)).toContain('data-theme="dark"');
  });

  it("uses light theme when theme cookie is light", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "light" }),
    } as never);
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    expect(renderToStaticMarkup(jsx)).toContain('data-theme="light"');
  });

  it("renders the vapid-public-key meta tag when the env var is set", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-key";
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('name="vapid-public-key"');
    expect(html).toContain('content="test-vapid-key"');
  });

  it("omits the vapid-public-key meta tag when the env var is unset", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("div"),
      params: Promise.resolve({ locale: "he" }),
    });
    expect(renderToStaticMarkup(jsx)).not.toContain('name="vapid-public-key"');
  });

  it("renders children inside the layout", async () => {
    const jsx = await LocaleLayout({
      children: React.createElement("p", { id: "test-child" }, "hello"),
      params: Promise.resolve({ locale: "he" }),
    });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('id="test-child"');
    expect(html).toContain("hello");
  });
});

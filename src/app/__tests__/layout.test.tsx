import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import RootLayout from "../layout";

const { mockCookieGet, mockHeaderGet } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockHeaderGet: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik" }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mockCookieGet }),
  headers: async () => ({ get: mockHeaderGet }),
}));

vi.mock("next/script", () => ({
  default: ({ id, strategy, children }: { id?: string; strategy?: string; children?: string }) =>
    React.createElement("script", {
      id,
      "data-strategy": strategy,
      dangerouslySetInnerHTML: { __html: children ?? "" },
    }),
}));

vi.mock("@/components/PendoInit", () => ({
  PendoInit: () => React.createElement("script", { id: "pendo-init" }),
}));

vi.mock("@/app/globals.css", () => ({}));

describe("RootLayout", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockHeaderGet.mockReset();
    mockCookieGet.mockReturnValue(undefined);
    mockHeaderGet.mockReturnValue(null);
  });

  it("owns the document shell", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div>content</div> }));
    expect(html).toContain('<html lang="he" dir="rtl" data-theme="dark"');
    expect(html).toContain("<div>content</div>");
  });

  it("uses the forwarded route locale before a stale locale cookie", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "NEXT_LOCALE" ? { value: "he" } : undefined
    );
    mockHeaderGet.mockImplementation((name: string) =>
      name === "x-next-intl-locale" ? "ar" : null
    );

    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    expect(html).toContain('<html lang="ar"');
  });

  it("loads the agent from the head, before hydration, without initializing it", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));

    expect(head).toContain('<script id="pendo-install" data-strategy="beforeInteractive">');
    expect(head).toContain("'https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js'");
    expect(head).toMatch(/\}\)\('[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'\);/);
    expect(head).not.toContain("pendo.initialize(");
  });

  it("initializes Pendo from the body, once the session has been verified", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('id="pendo-init"');
  });

  it("emits a snippet that inserts the agent and queues nothing", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    const match = html.match(/<script id="pendo-install"[^>]*>([\s\S]*?)<\/script>/);
    const source = (match?.[1] ?? "")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    const inserted: Array<{ src: string }> = [];
    const anchor = {
      parentNode: { insertBefore: (node: { src: string }) => inserted.push(node) },
    };
    const fakeWindow: Record<string, unknown> = {};
    const fakeDocument = {
      createElement: () => ({ src: "", async: false }),
      getElementsByTagName: () => [anchor],
    };
    new Function("window", "document", source)(fakeWindow, fakeDocument);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].src).toMatch(
      /^https:\/\/cdn\.pendo\.io\/agent\/static\/[0-9a-f-]{36}\/pendo\.js$/
    );
    expect((fakeWindow.pendo as { _q: unknown[][] })._q).toEqual([]);
  });
});

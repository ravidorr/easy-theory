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
    expect(html).toContain("<body><div>content</div></body>");
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

  it("loads Pendo and initializes it once from the head, before hydration", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));

    expect(head).toContain('<script id="pendo-install" data-strategy="beforeInteractive">');
    expect(head).toContain("'https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js'");
    expect(head).toMatch(/\}\)\('[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'\);/);
    expect(head.match(/pendo\.initialize\(/g)).toEqual(["pendo.initialize("]);
    expect(head).toContain("pendo.initialize({ visitor: { id: '' } });");
  });

  it("emits a snippet that inserts the agent and queues exactly one anonymous initialize", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));
    const match = html.match(/<script id="pendo-install"[^>]*>([\s\S]*?)<\/script>/);
    const source = (match?.[1] ?? "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    expect(source).toContain("pendo.initialize(");

    const inserted: Array<{ src: string }> = [];
    const anchor = {
      parentNode: { insertBefore: (node: { src: string }) => inserted.push(node) },
    };
    const fakeWindow: Record<string, unknown> = {};
    const fakeDocument = {
      createElement: () => ({ src: "", async: false }),
      getElementsByTagName: () => [anchor],
    };

    // `with` makes the bare `pendo` in the snippet resolve against the fake window,
    // as it does against the real one in a browser.
    new Function("window", "document", `with (window) { ${source} }`)(fakeWindow, fakeDocument);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].src).toMatch(
      /^https:\/\/cdn\.pendo\.io\/agent\/static\/[0-9a-f-]{36}\/pendo\.js$/
    );
    const queue = (fakeWindow.pendo as { _q: unknown[][] })._q;
    expect(queue.filter(([method]) => method === "initialize")).toEqual([
      ["initialize", { visitor: { id: "" } }],
    ]);
  });
});

import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import RootLayout from "../layout";

const { mockCookieGet, mockCookieGetAll, mockHeaderGet } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookieGetAll: vi.fn(),
  mockHeaderGet: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Rubik: vi.fn().mockReturnValue({ variable: "--font-rubik" }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mockCookieGet, getAll: mockCookieGetAll }),
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
    mockCookieGetAll.mockReset();
    mockCookieGetAll.mockReturnValue([]);
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
    expect(head).toContain("pendo.initialize({ visitor: { id: '' }, forceAnonymous: true });");
  });

  it("keeps a persisted identity on initialize while a Supabase session cookie exists", async () => {
    mockCookieGetAll.mockReturnValue([{ name: "sb-abc-auth-token.0", value: "x" }]);

    const html = renderToStaticMarkup(await RootLayout({ children: <div /> }));

    expect(html).toContain("pendo.initialize({ visitor: { id: '' } });");
    expect(html).not.toContain("forceAnonymous");
  });

  it("emits a snippet that inserts the agent and queues exactly one anonymous initialize", async () => {
    const { queue, inserted } = await runRootSnippet([]);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].src).toMatch(
      /^https:\/\/cdn\.pendo\.io\/agent\/static\/[0-9a-f-]{36}\/pendo\.js$/
    );
    expect(queue.filter(([method]) => method === "initialize")).toEqual([
      ["initialize", { visitor: { id: "" }, forceAnonymous: true }],
    ]);
  });

  // The fake agent below encodes the documented behavior this fix relies on
  // (web-sdk.pendo.io/config/core, `forceAnonymous`): initialize reads a
  // persisted identity back, even for an empty `visitor.id`, unless
  // `forceAnonymous` is set and the persisted id is identified. It is a model of
  // the documented contract, not the real agent.
  function fakeAgent(persistedVisitorId: string, queue: unknown[][]) {
    let visitorId = persistedVisitorId;
    const clearSession = vi.fn(() => {
      visitorId = "_PENDO_T_new";
    });
    const isAnonymous = (id: string) => id.startsWith("_PENDO_T_");
    const agent = {
      clearSession,
      isAnonymousVisitor: () => isAnonymous(visitorId),
      getVisitorId: () => visitorId,
    };
    for (const [method, options] of queue) {
      if (method === "initialize") {
        const opts = options as { forceAnonymous?: boolean };
        if (opts.forceAnonymous && !isAnonymous(visitorId)) visitorId = "_PENDO_T_fresh";
      }
    }
    return agent;
  }

  async function runSignedOutReset() {
    vi.resetModules();
    vi.doMock("@/lib/supabase", () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    vi.doMock("@/lib/pendo", () => ({ getPendoVisitor: vi.fn() }));
    vi.doMock("@/lib/monitoring", () => ({ reportError: vi.fn() }));
    const { PendoIdentify } = await import("@/components/PendoIdentify");
    const element = await PendoIdentify();
    return element?.props.children as string;
  }

  it("clears a stale learner identity after logout: no session cookie, root initializer, then reset", async () => {
    const { queue, fakeWindow } = await runRootSnippet([]);
    const agent = fakeAgent("learner-1", queue);
    expect(agent.getVisitorId()).toMatch(/^_PENDO_T_/);

    vi.useFakeTimers();
    Object.assign(fakeWindow.pendo as object, agent);
    vi.stubGlobal("window", fakeWindow);
    eval(await runSignedOutReset());
    vi.advanceTimersByTime(500);

    expect(agent.getVisitorId()).toMatch(/^_PENDO_T_/);
    expect(agent.getVisitorId()).not.toBe("learner-1");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("clears a stale learner identity after session expiry: cookie still present, root initializer, then reset", async () => {
    const { queue, fakeWindow } = await runRootSnippet([{ name: "sb-abc-auth-token", value: "x" }]);
    const agent = fakeAgent("learner-1", queue);
    // initialize kept the persisted identity, exactly the stale case.
    expect(agent.getVisitorId()).toBe("learner-1");

    vi.useFakeTimers();
    Object.assign(fakeWindow.pendo as object, agent);
    vi.stubGlobal("window", fakeWindow);
    eval(await runSignedOutReset());
    vi.advanceTimersByTime(500);

    expect(agent.clearSession).toHaveBeenCalledTimes(1);
    expect(agent.getVisitorId()).not.toBe("learner-1");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

async function runRootSnippet(cookies: Array<{ name: string; value: string }>) {
  mockCookieGetAll.mockReturnValue(cookies);
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

  // `with` makes the bare `pendo` in the snippet resolve against the fake window,
  // as it does against the real one in a browser.
  new Function("window", "document", `with (window) { ${source} }`)(fakeWindow, fakeDocument);

  return {
    inserted,
    fakeWindow,
    queue: (fakeWindow.pendo as { _q: unknown[][] })._q,
  };
}

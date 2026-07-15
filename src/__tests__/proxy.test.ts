import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "../proxy";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } })
);

// Capture the intl middleware fn so tests can control its return value per-test
const mockIntlMiddlewareFn = vi.hoisted(() =>
  vi.fn().mockReturnValue({ status: 200, cookies: { set: vi.fn() } })
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn().mockImplementation(() => ({ status: 200, cookies: { set: vi.fn() } })),
    redirect: vi.fn().mockImplementation((url: URL | string) =>
      new Response(null, {
        status: 307,
        headers: { location: typeof url === "string" ? url : url.href },
      })
    ),
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn().mockReturnValue(mockIntlMiddlewareFn),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["he", "ar"], defaultLocale: "he" },
}));

function makeRequest(path: string): NextRequest {
  const url = new URL(`http://localhost${path}`);
  return {
    cookies: { getAll: () => [], set: () => {} },
    nextUrl: {
      pathname: path,
      clone: () => new URL(url.href),
    },
    headers: new Headers(),
    url: url.href,
  } as unknown as NextRequest;
}

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockIntlMiddlewareFn.mockReturnValue({ status: 200, cookies: { set: vi.fn() } });
  });

  describe("intl middleware integration", () => {
    it("returns intl redirect immediately when intl middleware returns non-200", async () => {
      mockIntlMiddlewareFn.mockReturnValue({
        status: 307,
        headers: new Headers({ location: "http://localhost/he/" }),
      });
      const res = await proxy(makeRequest("/"));
      expect(res.status).toBe(307);
      // auth guard never runs — Supabase client not created
      expect(vi.mocked(createServerClient)).not.toHaveBeenCalled();
    });
  });

  describe("authenticated user", () => {
    it("passes through private paths", async () => {
      const res = await proxy(makeRequest("/he/topics"));
      expect(res.status).toBe(200);
    });

    it("passes through the home route", async () => {
      const res = await proxy(makeRequest("/he/"));
      expect(res.status).toBe(200);
    });

    it("passes through /he/auth/* paths", async () => {
      const res = await proxy(makeRequest("/he/auth/login"));
      expect(res.status).toBe(200);
    });

    it("passes through /ar locale paths", async () => {
      const res = await proxy(makeRequest("/ar/topics"));
      expect(res.status).toBe(200);
    });
  });

  describe("unauthenticated user - private paths", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("redirects /he/ to /he/auth/login", async () => {
      const res = await proxy(makeRequest("/he/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/he/auth/login");
    });

    it("redirects /he/topics to /he/auth/login", async () => {
      const res = await proxy(makeRequest("/he/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/he/auth/login");
    });

    it("preserves the return path as a next query param", async () => {
      const res = await proxy(makeRequest("/he/exam"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "http://localhost/he/auth/login?next=%2Fexam"
      );
    });

    it("preserves query strings in the return path", async () => {
      const res = await proxy(makeRequest("/he/topics/signs"));
      expect(res.headers.get("location")).toBe(
        "http://localhost/he/auth/login?next=%2Ftopics%2Fsigns"
      );
    });

    it("does not open-redirect via protocol-relative next paths", async () => {
      const res = await proxy(makeRequest("/he//evil.com"));
      const location = res.headers.get("location") ?? "";
      expect(location).not.toContain("evil.com");
      expect(location).toContain("next=%2F");
    });

    it("redirects /ar/topics to /ar/auth/login", async () => {
      const res = await proxy(makeRequest("/ar/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/ar/auth/login");
    });

    it("redirects /he/flashcards to /he/auth/login", async () => {
      const res = await proxy(makeRequest("/he/flashcards"));
      expect(res.status).toBe(307);
    });

    it("redirects a non-locale-prefixed path using the default locale", async () => {
      const res = await proxy(makeRequest("/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/he/auth/login");
    });
  });

  describe("unauthenticated user - public paths", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("allows /he/auth/login through", async () => {
      const res = await proxy(makeRequest("/he/auth/login"));
      expect(res.status).toBe(200);
    });

    it("allows /ar/auth/login through", async () => {
      const res = await proxy(makeRequest("/ar/auth/login"));
      expect(res.status).toBe(200);
    });

    it("allows /api/auth/send-otp through (skip guard)", async () => {
      const res = await proxy(makeRequest("/api/auth/send-otp"));
      expect(res.status).toBe(200);
    });

    it("allows /auth/callback through without invoking the intl middleware (skip guard)", async () => {
      // Regression: next-intl used to redirect /auth/callback → /he/auth/callback,
      // which has no route (404), breaking every magic-link login.
      const res = await proxy(makeRequest("/auth/callback"));
      expect(res.status).toBe(200);
      expect(mockIntlMiddlewareFn).not.toHaveBeenCalled();
    });

    it("still routes locale-less /auth/login through the intl middleware", async () => {
      // The callback's error redirect targets /auth/login and relies on
      // next-intl to add the locale prefix — it must NOT be skipped.
      await proxy(makeRequest("/auth/login"));
      expect(mockIntlMiddlewareFn).toHaveBeenCalled();
    });

    it("allows /signs/sign-301.png through (skip guard)", async () => {
      const res = await proxy(makeRequest("/signs/sign-301.png"));
      expect(res.status).toBe(200);
    });

    it("allows /questions/q1.jpg through (skip guard)", async () => {
      const res = await proxy(makeRequest("/questions/q1.jpg"));
      expect(res.status).toBe(200);
    });

    it("allows /js/quiz.js through (skip guard)", async () => {
      const res = await proxy(makeRequest("/js/quiz.js"));
      expect(res.status).toBe(200);
    });

    it("allows /_next/static/main.js through (skip guard)", async () => {
      const res = await proxy(makeRequest("/_next/static/main.js"));
      expect(res.status).toBe(200);
    });

    it("allows /favicon.ico through (skip guard)", async () => {
      const res = await proxy(makeRequest("/favicon.ico"));
      expect(res.status).toBe(200);
    });

    it("allows /manifest.webmanifest through without touching Supabase (skip guard)", async () => {
      const res = await proxy(makeRequest("/manifest.webmanifest"));
      expect(res.status).toBe(200);
      expect(vi.mocked(createServerClient)).not.toHaveBeenCalled();
    });

    it("allows /sw.js through (skip guard)", async () => {
      const res = await proxy(makeRequest("/sw.js"));
      expect(res.status).toBe(200);
    });
  });

  describe("cookie callbacks passed to createServerClient", () => {
    it("getAll returns the request cookies", async () => {
      const request = makeRequest("/he/topics");
      await proxy(request);
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      expect(options.cookies.getAll()).toEqual([]);
    });

    it("setAll sets cookies on the intl response (not via NextResponse.next)", async () => {
      const cookiesSetMock = vi.fn();
      mockIntlMiddlewareFn.mockReturnValueOnce({ status: 200, cookies: { set: cookiesSetMock } });
      const request = makeRequest("/he/topics");
      await proxy(request);
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      options.cookies.setAll([{ name: "session", value: "tok", options: { httpOnly: true } }]);
      // Cookies are written directly onto intlRes — NextResponse.next is never called
      expect(vi.mocked(NextResponse.next)).not.toHaveBeenCalled();
      expect(cookiesSetMock).toHaveBeenCalledWith("session", "tok", { httpOnly: true });
    });
  });

  describe("Supabase error handling", () => {
    it("treats Supabase connection error as unauthenticated and redirects", async () => {
      mockGetUser.mockRejectedValue(new Error("connection failed"));
      const res = await proxy(makeRequest("/he/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/he/auth/login");
    });

    it("allows public paths even when Supabase is unreachable", async () => {
      mockGetUser.mockRejectedValue(new Error("connection failed"));
      const res = await proxy(makeRequest("/he/auth/login"));
      expect(res.status).toBe(200);
    });
  });
});

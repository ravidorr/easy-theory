import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "../proxy";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

const mockGetUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } })
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
  });

  describe("authenticated user", () => {
    it("passes through private paths", async () => {
      const res = await proxy(makeRequest("/topics"));
      expect(res.status).toBe(200);
    });

    it("passes through the home route", async () => {
      const res = await proxy(makeRequest("/"));
      expect(res.status).toBe(200);
    });

    it("passes through /auth/* paths", async () => {
      const res = await proxy(makeRequest("/auth/login"));
      expect(res.status).toBe(200);
    });
  });

  describe("unauthenticated user — private paths", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("redirects / to /auth/login", async () => {
      const res = await proxy(makeRequest("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("redirects /topics to /auth/login", async () => {
      const res = await proxy(makeRequest("/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("redirects /flashcards to /auth/login", async () => {
      const res = await proxy(makeRequest("/flashcards"));
      expect(res.status).toBe(307);
    });
  });

  describe("unauthenticated user — public paths", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("allows /auth/login through", async () => {
      const res = await proxy(makeRequest("/auth/login"));
      expect(res.status).toBe(200);
    });

    it("allows /api/auth/send-otp through", async () => {
      const res = await proxy(makeRequest("/api/auth/send-otp"));
      expect(res.status).toBe(200);
    });

    it("allows /signs/sign-301.png through", async () => {
      const res = await proxy(makeRequest("/signs/sign-301.png"));
      expect(res.status).toBe(200);
    });

    it("allows /questions/q1.jpg through", async () => {
      const res = await proxy(makeRequest("/questions/q1.jpg"));
      expect(res.status).toBe(200);
    });

    it("allows /js/quiz.js through", async () => {
      const res = await proxy(makeRequest("/js/quiz.js"));
      expect(res.status).toBe(200);
    });

    it("allows /_next/static/main.js through", async () => {
      const res = await proxy(makeRequest("/_next/static/main.js"));
      expect(res.status).toBe(200);
    });

    it("allows /favicon.ico through", async () => {
      const res = await proxy(makeRequest("/favicon.ico"));
      expect(res.status).toBe(200);
    });
  });

  describe("cookie callbacks passed to createServerClient", () => {
    it("getAll returns the request cookies", async () => {
      const request = makeRequest("/topics");
      await proxy(request);
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      expect(options.cookies.getAll()).toEqual([]);
    });

    it("setAll sets cookies on the request and updates the response", async () => {
      const request = makeRequest("/topics");
      await proxy(request);
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      options.cookies.setAll([{ name: "session", value: "tok", options: { httpOnly: true } }]);
    });
  });

  describe("Supabase error handling", () => {
    it("treats Supabase connection error as unauthenticated and redirects", async () => {
      mockGetUser.mockRejectedValue(new Error("connection failed"));
      const res = await proxy(makeRequest("/topics"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("allows public paths even when Supabase is unreachable", async () => {
      mockGetUser.mockRejectedValue(new Error("connection failed"));
      const res = await proxy(makeRequest("/auth/login"));
      expect(res.status).toBe(200);
    });
  });
});

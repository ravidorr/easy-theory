import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// vi.mock is hoisted — use vi.hoisted() so the variable is available inside the factory.
const mockExchangeCode = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { exchangeCodeForSession: mockExchangeCode },
  }),
}));

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/auth/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCode.mockResolvedValue({ error: null });
  });

  it("redirects to /auth/login?error=1 when no code param", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=1");
  });

  it("redirects to / on successful code exchange with no next param", async () => {
    const res = await GET(makeRequest({ code: "abc123" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects to the next param on success when it is a safe path", async () => {
    const res = await GET(makeRequest({ code: "abc123", next: "/topics" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/topics");
  });

  it("sanitises next to / when it starts with //", async () => {
    const res = await GET(makeRequest({ code: "abc123", next: "//evil.com" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects to /auth/login?error=1 when code exchange fails", async () => {
    mockExchangeCode.mockResolvedValue({ error: { message: "invalid code" } });
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=1");
  });

  describe("cookie callbacks passed to createServerClient", () => {
    it("getAll returns the cookie store cookies", async () => {
      await GET(makeRequest({ code: "abc123" }));
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      expect(options.cookies.getAll()).toEqual([]);
    });

    it("setAll sets cookies on the cookie store", async () => {
      await GET(makeRequest({ code: "abc123" }));
      const options = vi.mocked(createServerClient).mock.calls[0][2] as {
        cookies: {
          getAll: () => unknown[];
          setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      };
      const cookieStore = await vi.mocked(cookies)();
      options.cookies.setAll([{ name: "a", value: "b", options: {} }]);
      expect(cookieStore.set).toHaveBeenCalledWith("a", "b", {});
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { trackServerEvent } from "@/lib/pendo-server";

// vi.mock is hoisted — use vi.hoisted() so the variable is available inside the factory.
const signedOut = vi.hoisted(() => ({ data: { user: null, session: null }, error: null }));
const mockExchangeCode = vi.hoisted(() => vi.fn().mockResolvedValue(signedOut));
const mockVerifyOtp = vi.hoisted(() => vi.fn().mockResolvedValue(signedOut));
const mockCookieGet = vi.hoisted(() => vi.fn().mockReturnValue(undefined));
// after() runs its task once the response has been sent, so the mock only queues it.
const afterTasks = vi.hoisted(() => [] as Array<() => unknown>);
const mockAfter = vi.hoisted(() =>
  vi.fn((task: () => unknown) => {
    afterTasks.push(task);
  })
);
async function flushAfter() {
  await Promise.all(afterTasks.splice(0).map((task) => task()));
}

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mockAfter,
}));

vi.mock("@/lib/pendo-server", () => ({ trackServerEvent: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
    get: mockCookieGet,
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
      verifyOtp: mockVerifyOtp,
    },
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
    afterTasks.length = 0;
    mockExchangeCode.mockResolvedValue(signedOut);
    mockVerifyOtp.mockResolvedValue(signedOut);
    mockCookieGet.mockReturnValue(undefined);
  });

  it("redirects to /auth/login?error=1 when no code or token_hash param", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=1");
  });

  it("redirects to /schedule on successful code exchange with no next param", async () => {
    const res = await GET(makeRequest({ code: "abc123" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/schedule");
  });

  it("redirects to the next param on success when it is a safe path", async () => {
    const res = await GET(makeRequest({ code: "abc123", next: "/topics" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/topics");
  });

  it("sanitises next to /schedule when it starts with //", async () => {
    const res = await GET(makeRequest({ code: "abc123", next: "//evil.com" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/schedule");
  });

  it("redirects to /auth/login?error=1 when code exchange fails", async () => {
    mockExchangeCode.mockResolvedValue({ error: { message: "invalid code" } });
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=1");
  });

  it("redirects to auth_redirect cookie value when next param is absent", async () => {
    mockCookieGet.mockReturnValue({ value: "/dashboard" });
    const res = await GET(makeRequest({ code: "abc123" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("prefers next search param over auth_redirect cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "/dashboard" });
    const res = await GET(makeRequest({ code: "abc123", next: "/topics" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/topics");
  });

  it("clears auth_redirect cookie on successful auth", async () => {
    const res = await GET(makeRequest({ code: "abc123" }));
    expect(res.status).toBe(307);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/auth_redirect=;|auth_redirect=.*Max-Age=0/);
  });

  it("uses token_hash flow when token_hash and type are present", async () => {
    const res = await GET(makeRequest({ token_hash: "abc", type: "email" }));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/schedule");
  });

  it("redirects to /auth/login?error=1 when verifyOtp fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "invalid token" } });
    const res = await GET(makeRequest({ token_hash: "bad", type: "email" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login?error=1");
  });

  describe("user_signed_in tracking", () => {
    const NOW = new Date("2026-07-30T05:00:00Z");

    function signedIn(createdAt: string) {
      return {
        data: { user: { id: "u1", created_at: createdAt }, session: {} },
        error: null,
      };
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("tracks a token-hash sign-in after the response, flagging a just-created account as new", async () => {
      mockVerifyOtp.mockResolvedValue(signedIn("2026-07-30T04:55:00Z"));

      const res = await GET(makeRequest({ token_hash: "abc", type: "email", next: "/topics" }));

      expect(res.headers.get("location")).toBe("http://localhost/topics");
      expect(mockAfter).toHaveBeenCalledTimes(1);
      expect(trackServerEvent).not.toHaveBeenCalled();
      await flushAfter();
      expect(trackServerEvent).toHaveBeenCalledWith("user_signed_in", "u1", {
        auth_flow: "token_hash",
        otp_type: "email",
        next_path: "/topics",
        is_new_user: true,
      });
    });

    it("tracks a PKCE sign-in by a returning learner", async () => {
      mockExchangeCode.mockResolvedValue(signedIn("2026-05-01T10:00:00Z"));

      await GET(makeRequest({ code: "abc123" }));
      await flushAfter();

      expect(trackServerEvent).toHaveBeenCalledWith("user_signed_in", "u1", {
        auth_flow: "pkce",
        next_path: "/schedule",
        is_new_user: false,
      });
    });

    it("reports only the path of the post-login target, never its query string", async () => {
      mockVerifyOtp.mockResolvedValue(signedIn("2026-05-01T10:00:00Z"));

      const res = await GET(
        makeRequest({ token_hash: "abc", type: "email", next: "/topics?utm=secret&email=a@b.co" })
      );
      await flushAfter();

      expect(res.headers.get("location")).toBe("http://localhost/topics?utm=secret&email=a@b.co");
      expect(trackServerEvent).toHaveBeenCalledWith(
        "user_signed_in",
        "u1",
        expect.objectContaining({ next_path: "/topics" })
      );
      expect(JSON.stringify(vi.mocked(trackServerEvent).mock.calls)).not.toContain("secret");
    });

    it("does not track when the session has no user or verification fails", async () => {
      await GET(makeRequest({ code: "abc123" }));
      mockVerifyOtp.mockResolvedValue({ error: { message: "invalid token" } });
      await GET(makeRequest({ token_hash: "bad", type: "email" }));

      expect(mockAfter).not.toHaveBeenCalled();
      expect(trackServerEvent).not.toHaveBeenCalled();
    });
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

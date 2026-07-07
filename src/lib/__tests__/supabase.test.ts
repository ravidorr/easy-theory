import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateSupabaseClient = vi.hoisted(() => vi.fn().mockReturnValue({ type: "admin" }));
const mockCreateServerClient = vi.hoisted(() => vi.fn().mockReturnValue({ type: "server" }));
const mockGetAll = vi.hoisted(() => vi.fn().mockReturnValue([]));
const mockSet = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateSupabaseClient,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: mockGetAll,
    set: mockSet,
  }),
}));

import { createAdminClient, createClient } from "../supabase";

describe("supabase helpers", () => {
  const SUPABASE_URL = "https://test.supabase.co";
  const ANON_KEY = "test-anon-key";
  const SERVICE_KEY = "test-service-key";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe("createAdminClient", () => {
    it("calls createClient with URL and service role key", () => {
      createAdminClient();
      expect(mockCreateSupabaseClient).toHaveBeenCalledWith(SUPABASE_URL, SERVICE_KEY);
    });

    it("returns the admin client", () => {
      const client = createAdminClient();
      expect(client).toEqual({ type: "admin" });
    });
  });

  describe("createClient", () => {
    it("calls createServerClient with URL and anon key", async () => {
      await createClient();
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        SUPABASE_URL,
        ANON_KEY,
        expect.objectContaining({ cookies: expect.any(Object) })
      );
    });

    it("returns the server client", async () => {
      const client = await createClient();
      expect(client).toEqual({ type: "server" });
    });

    it("cookies.getAll() delegates to the cookie store", async () => {
      await createClient();
      const [, , { cookies }] = mockCreateServerClient.mock.calls[0] as [
        string,
        string,
        { cookies: { getAll: () => unknown; setAll: (c: unknown[]) => void } },
      ];
      cookies.getAll();
      expect(mockGetAll).toHaveBeenCalled();
    });

    it("cookies.setAll() silently ignores errors from read-only Server Components", async () => {
      mockSet.mockImplementation(() => { throw new Error("read-only"); });
      await createClient();
      const [, , { cookies }] = mockCreateServerClient.mock.calls[0] as [
        string,
        string,
        { cookies: { getAll: () => unknown; setAll: (c: { name: string; value: string; options?: unknown }[]) => void } },
      ];
      // Should not throw even though mockSet throws
      expect(() =>
        cookies.setAll([{ name: "theme", value: "dark" }])
      ).not.toThrow();
    });
  });
});

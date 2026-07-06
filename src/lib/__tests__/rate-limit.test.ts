import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "../rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeClient(data: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data }),
  } as unknown as SupabaseClient;
}

describe("checkRateLimit", () => {
  it("returns true when RPC returns true", async () => {
    expect(await checkRateLimit(makeClient(true), "key", 10, 60)).toBe(true);
  });

  it("returns false when RPC returns false", async () => {
    expect(await checkRateLimit(makeClient(false), "key", 10, 60)).toBe(false);
  });

  it("returns false when RPC returns null", async () => {
    expect(await checkRateLimit(makeClient(null), "key", 10, 60)).toBe(false);
  });

  it("passes correct parameters to the RPC function", async () => {
    const supabase = makeClient(true);
    await checkRateLimit(supabase, "user:abc", 5, 300);
    expect(supabase.rpc).toHaveBeenCalledWith("check_and_increment_rate_limit", {
      p_key: "user:abc",
      p_limit: 5,
      p_window_seconds: 300,
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);

describe("POST /api/auth/logout", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("signs out and returns { ok: true }", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue({ auth: { signOut } } as never);

    const res = await POST();

    expect(signOut).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

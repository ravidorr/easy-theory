import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "../auth";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

const mockRedirect = vi.mocked(redirect);
const user = { id: "learner-1" } as User;

function client(currentUser: User | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: currentUser } }),
    },
  };
}

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the authenticated user", async () => {
    const supabase = client(user);

    await expect(
      requireAuthenticatedUser(supabase as never, "/auth/login?next=/practice")
    ).resolves.toBe(user);
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects with the caller-provided login URL unchanged", async () => {
    const href = "/auth/login?next=%2Ftopics%2Fsigns%2Fretry%3Fscope%3Dall";

    await expect(requireAuthenticatedUser(client(null) as never, href)).rejects.toThrow("redirect");
    expect(mockRedirect).toHaveBeenCalledWith(href);
  });
});

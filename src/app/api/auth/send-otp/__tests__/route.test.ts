import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: object) {
  return new Request("http://localhost/api/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClient(otpError: boolean = false) {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({
        error: otpError ? { message: "OTP failed" } : null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: true }),
  };
}

describe("POST /api/auth/send-otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 400 when email is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email format is invalid", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 500 when Supabase OTP call fails", async () => {
    mockCreateClient.mockResolvedValue(makeClient(true) as never);
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(500);
  });

  it("returns { ok: true } on success", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makeRequest({ email: "  User@Example.COM  " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("normalises email to lowercase before calling OTP", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    await POST(makeRequest({ email: "  User@Example.COM  " }));
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" })
    );
  });

  it("passes the request origin as redirect URL", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    await POST(makeRequest({ email: "user@example.com" }));
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        }),
      })
    );
  });
});

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

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(
      new Request("http://localhost/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
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

  it("passes clean callback URL with no query params as emailRedirectTo", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    await POST(makeRequest({ email: "user@example.com" }));
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost/auth/callback",
        }),
      })
    );
  });

  it("sets auth_redirect cookie to next path on success", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await POST(makeRequest({ email: "user@example.com", next: "/topics/signs/review" }));
    expect(res.headers.get("set-cookie")).toMatch(/auth_redirect=.*topics.*signs.*review/);
  });

  it("sets auth_redirect cookie to / when next is omitted", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.headers.get("set-cookie")).toMatch(/auth_redirect=%2F/);
  });

  it("ignores next when it does not start with / and defaults cookie to /", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await POST(makeRequest({ email: "user@example.com", next: "https://evil.com" }));
    const call = client.auth.signInWithOtp.mock.calls[0][0];
    expect(call.options.emailRedirectTo).not.toContain("evil");
    expect(res.headers.get("set-cookie")).toMatch(/auth_redirect=%2F/);
  });

  it("ignores next when it starts with // and defaults cookie to /", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await POST(makeRequest({ email: "user@example.com", next: "//evil.com/path" }));
    const call = client.auth.signInWithOtp.mock.calls[0][0];
    expect(call.options.emailRedirectTo).not.toContain("evil");
    expect(res.headers.get("set-cookie")).toMatch(/auth_redirect=%2F/);
  });
});

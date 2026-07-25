import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { createAdminClient, createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

const { mockEmailSend } = vi.hoisted(() => ({
  mockEmailSend: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));
vi.mock("resend", () => ({
  Resend: vi.fn(function mockResend(this: unknown) {
    return { emails: { send: mockEmailSend } };
  }),
}));

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: object, locale = "he") {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `NEXT_LOCALE=${locale}` },
    body: JSON.stringify(body),
  });
}

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function makeAdminClient(insertError: { message: string } | null = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  return { from: vi.fn().mockReturnValue({ insert }), insert };
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONTACT_NOTIFICATION_EMAIL", "support@example.com");
    vi.stubEnv("RESEND_FROM_EMAIL", "Easy Theory <notifications@example.com>");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient() as never);
    mockCheckRateLimit.mockResolvedValue(true);
    mockEmailSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated requests", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ topic: "question", message: "Broken question" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid topics, messages, and reply emails", async () => {
    for (const body of [
      { topic: "other", message: "Message" },
      { topic: "question", message: "  " },
      { topic: "question", message: "Message", reply_email: "not-an-email" },
    ]) {
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    }
  });

  it("rate limits contact messages per authenticated user", async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ topic: "question", message: "Message" }));
    expect(res.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.anything(), "contact:u1", 5, 3600);
  });

  it("stores the normalized message and sends a notification", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);
    const res = await POST(
      makeRequest({ topic: "idea", message: "  A useful idea  ", reply_email: " Reply@Example.com " }, "ar")
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(admin.from).toHaveBeenCalledWith("contact_messages");
    expect(admin.insert).toHaveBeenCalledWith({
      user_id: "u1",
      topic: "idea",
      message: "A useful idea",
      reply_email: "reply@example.com",
      locale: "ar",
    });
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Easy Theory <notifications@example.com>",
        to: "support@example.com",
        replyTo: "reply@example.com",
        subject: "New Easy Theory contact message: idea",
      })
    );
  });

  it("returns 500 without persisting when the verified sender is not configured", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await POST(makeRequest({ topic: "question", message: "Message" }));

    expect(res.status).toBe(500);
    expect(admin.insert).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      "contact",
      "RESEND_FROM_EMAIL is not configured",
      expect.anything()
    );
  });

  it("returns 500 when the message cannot be stored", async () => {
    mockCreateAdminClient.mockReturnValue(makeAdminClient({ message: "db unavailable" }) as never);
    const res = await POST(makeRequest({ topic: "bug", message: "Message" }));
    expect(res.status).toBe(500);
    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith("contact", "message insert failed", expect.anything(), { userId: "u1" });
  });

  it("keeps a stored message successful when notification delivery fails", async () => {
    mockEmailSend.mockResolvedValue({ data: null, error: new Error("resend unavailable") });
    const res = await POST(makeRequest({ topic: "general", message: "Message" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(reportError).toHaveBeenCalledWith("contact", "notification send failed", expect.anything(), { userId: "u1" });
  });
});

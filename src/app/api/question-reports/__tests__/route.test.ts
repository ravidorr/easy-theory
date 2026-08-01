import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { createAdminClient, createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn() }));

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
const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const TOPIC_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: object) {
  return new Request("http://localhost/api/question-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "NEXT_LOCALE=he" },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return { question_id: QUESTION_ID, topic_id: TOPIC_ID, locale: "he" };
}

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function makeAdminClient({
  question = { data: { topic_id: TOPIC_ID }, error: null },
  topic = { data: { id: TOPIC_ID, slug: "signs" }, error: null },
  existing = { data: null, error: null },
  insert = { data: { id: "r1" }, error: null },
  sourceRelease = { data: null, error: null },
  sourceReleaseRejects = false,
}: Partial<Record<"question" | "topic" | "existing" | "insert" | "sourceRelease", { data: unknown; error: unknown }>> & { sourceReleaseRejects?: boolean } = {}) {
  const questionMaybeSingle = vi.fn().mockResolvedValue(question);
  const topicMaybeSingle = vi.fn().mockResolvedValue(topic);
  const existingMaybeSingle = vi.fn().mockResolvedValue(existing);
  const insertSingle = vi.fn().mockResolvedValue(insert);
  const sourceReleaseMaybeSingle = sourceReleaseRejects
    ? vi.fn().mockRejectedValue(new Error("source release unavailable"))
    : vi.fn().mockResolvedValue(sourceRelease);
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insertReport = vi.fn().mockReturnValue({ select: insertSelect });
  const reports = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingle }) }),
    }),
    insert: insertReport,
  };
  const from = vi.fn((table: string) => {
    if (table === "questions") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: questionMaybeSingle }) }) };
    }
    if (table === "topics") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: topicMaybeSingle }) }) };
    }
    if (table === "content_source_releases") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: sourceReleaseMaybeSingle }) }) };
    }
    return reports;
  });
  return { from, insertReport, insertSingle };
}

describe("POST /api/question-reports", () => {
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

  it("rejects unauthenticated and invalid reports", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    expect((await POST(makeRequest(validBody()))).status).toBe(401);

    mockCreateClient.mockResolvedValue(makeClient() as never);
    for (const body of [
      { ...validBody(), question_id: "not-a-uuid" },
      { ...validBody(), locale: "en" },
      { ...validBody(), comment: "  " },
      { ...validBody(), comment: "x".repeat(1001) },
    ]) {
      expect((await POST(makeRequest(body))).status).toBe(400);
    }
  });

  it("rejects malformed and empty JSON with a localized validation error", async () => {
    const requests = [
      new Request("http://localhost/api/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "NEXT_LOCALE=he" },
        body: "{",
      }),
      new Request("http://localhost/api/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "NEXT_LOCALE=he" },
      }),
    ];

    for (const request of requests) {
      const response = await POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "יש לבדוק את פרטי הדיווח ולנסות שוב." });
    }
  });

  it("rejects a topic that does not own the reported question", async () => {
    const admin = makeAdminClient({ question: { data: { topic_id: "other-topic" }, error: null } });
    mockCreateAdminClient.mockReturnValue(admin as never);
    expect((await POST(makeRequest(validBody()))).status).toBe(400);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns a localized failure when validating report ownership fails", async () => {
    const cases = [
      {
        admin: makeAdminClient({ question: { data: null, error: { message: "questions unavailable" } } }),
        message: "question lookup failed",
        context: { userId: "u1", questionId: QUESTION_ID },
      },
      {
        admin: makeAdminClient({ topic: { data: null, error: { message: "topics unavailable" } } }),
        message: "topic lookup failed",
        context: { userId: "u1", topicId: TOPIC_ID },
      },
      {
        admin: makeAdminClient({ topic: { data: null, error: null } }),
        message: null,
        context: null,
      },
      {
        admin: makeAdminClient({ existing: { data: null, error: { message: "reports unavailable" } } }),
        message: "existing report lookup failed",
        context: { userId: "u1", questionId: QUESTION_ID },
      },
    ];

    for (const { admin, message, context } of cases) {
      mockCreateAdminClient.mockReturnValue(admin as never);
      const response = await POST(makeRequest(validBody()));

      expect(response.status).toBe(message ? 500 : 400);
      expect(await response.json()).toEqual({
        error: message ? "לא ניתן לשמור את הדיווח. אפשר לנסות שוב." : "יש לבדוק את פרטי הדיווח ולנסות שוב.",
      });
      if (message) {
        expect(reportError).toHaveBeenCalledWith("question-reports", message, expect.anything(), context);
      }
    }
  });

  it("rate limits new reports per authenticated user", async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    expect((await POST(makeRequest(validBody()))).status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.anything(), "question-reports:u1", 5, 3600);
  });

  it("stores the normalized report and sends its full notification context", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);
    const response = await POST(makeRequest({ ...validBody(), comment: "  Incorrect answer  " }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(admin.insertReport).toHaveBeenCalledWith({
      user_id: "u1",
      question_id: QUESTION_ID,
      comment: "Incorrect answer",
      locale: "he",
      category: "unclear",
      source_checksum: null,
    });
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Easy Theory question report: signs",
        text: expect.stringContaining(`Report ID: r1\nUser ID: u1\nQuestion ID: ${QUESTION_ID}\nTopic ID: ${TOPIC_ID}\nTopic slug: signs`),
      })
    );
  });

  it("persists a valid selected report category", async () => {
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest({ ...validBody(), category: "image" }));

    expect(response.status).toBe(200);
    expect(admin.insertReport).toHaveBeenCalledWith(
      expect.objectContaining({ category: "image" })
    );
  });

  it("persists source metadata when the reported question has a release", async () => {
    const admin = makeAdminClient({
      question: { data: { topic_id: TOPIC_ID, source_release_id: "release-1" }, error: null },
      sourceRelease: { data: { source_checksum: "checksum-1" }, error: null },
    } as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    expect((await POST(makeRequest(validBody()))).status).toBe(200);
    expect(admin.insertReport).toHaveBeenCalledWith(expect.objectContaining({ source_checksum: "checksum-1" }));
  });

  it("keeps reporting available when source-release metadata cannot be loaded", async () => {
    const admin = makeAdminClient({
      question: { data: { topic_id: TOPIC_ID, source_release_id: "release-1" }, error: null },
      sourceReleaseRejects: true,
    });
    mockCreateAdminClient.mockReturnValue(admin as never);

    expect((await POST(makeRequest(validBody()))).status).toBe(200);
    expect(admin.insertReport).toHaveBeenCalledWith(expect.objectContaining({ source_checksum: null }));
    expect(reportError).toHaveBeenCalledWith(
      "question-reports",
      "source release lookup failed",
      expect.anything(),
      { userId: "u1" }
    );
  });

  it("keeps existing and racing duplicate reports successful without a notification", async () => {
    const existing = makeAdminClient({ existing: { data: { id: "r1" }, error: null } });
    mockCreateAdminClient.mockReturnValue(existing as never);
    expect(await (await POST(makeRequest(validBody()))).json()).toEqual({ ok: true });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();

    const raced = makeAdminClient({ insert: { data: null, error: { code: "23505" } } });
    mockCreateAdminClient.mockReturnValue(raced as never);
    expect(await (await POST(makeRequest(validBody()))).json()).toEqual({ ok: true });
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("returns a localized failure when the report cannot be persisted", async () => {
    const admin = makeAdminClient({ insert: { data: null, error: { message: "database unavailable" } } });
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest(validBody()));
    expect(response.status).toBe(500);
    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      "question-reports",
      "report insert failed",
      expect.anything(),
      { userId: "u1", questionId: QUESTION_ID }
    );
  });

  it("keeps a persisted report successful when email delivery or configuration fails", async () => {
    mockEmailSend.mockResolvedValue({ data: null, error: new Error("resend unavailable") });
    expect(await (await POST(makeRequest(validBody()))).json()).toEqual({ ok: true });
    expect(reportError).toHaveBeenCalledWith(
      "question-reports",
      "notification send failed",
      expect.anything(),
      { userId: "u1", reportId: "r1" }
    );

    vi.stubEnv("RESEND_FROM_EMAIL", "");
    expect(await (await POST(makeRequest(validBody()))).json()).toEqual({ ok: true });
    expect(reportError).toHaveBeenCalledWith(
      "question-reports",
      "notification email is not configured",
      expect.anything(),
      { userId: "u1", reportId: "r1" }
    );
  });
});

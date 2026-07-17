import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { createAdminClient } from "@/lib/supabase";
import { getUsersScheduledForDay, getPushSubscriptionsForUsers } from "@/lib/db";
import { reportError } from "@/lib/monitoring";
import heMessages from "../../../../../../messages/he.json";
import arMessages from "../../../../../../messages/ar.json";

// vi.hoisted ensures these are initialised before the vi.mock factories run.
const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockEmailSend = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "email-id" }));

vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getUsersScheduledForDay: vi.fn(),
  getPushSubscriptionsForUsers: vi.fn(),
}));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}));
// Resend must use a regular function (not arrow) so `new Resend()` works.
vi.mock("resend", () => ({
  Resend: vi.fn(function mockResend(this: unknown) {
    return { emails: { send: mockEmailSend } };
  }),
}));

const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockGetSchedules = vi.mocked(getUsersScheduledForDay);
const mockGetPushSubs = vi.mocked(getPushSubscriptionsForUsers);


function makeRequest(headers: Record<string, string> = { authorization: "Bearer secret123" }) {
  return new Request("http://localhost/api/cron/notify", { headers });
}

function makeAdminClient() {
  const deleteChain = {} as Record<string, unknown>;
  deleteChain.eq = vi.fn().mockReturnValue(deleteChain);
  deleteChain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(onFulfilled);

  return {
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue(deleteChain),
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: "user@example.com" } },
        }),
      },
    },
  };
}

const SCHEDULE = {
  user_id: "u1",
  start_time: "08:00:00",
  duration_minutes: 45,
  locale: "he" as const,
};
const SCHEDULE_AR = { ...SCHEDULE, locale: "ar" as const };
const PUSH_SUB = { user_id: "u1", endpoint: "https://push.example.com", auth: "auth", p256dh: "p256" };

describe("GET /api/cron/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret123";
    mockCreateAdminClient.mockReturnValue(makeAdminClient() as never);
    mockGetSchedules.mockResolvedValue([]);
    mockGetPushSubs.mockResolvedValue([]);
  });

  it("returns 500 and does no work when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(mockGetSchedules).not.toHaveBeenCalled();
  });

  it("returns 401 when auth header is wrong", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when auth header is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(401);
    expect(mockGetSchedules).not.toHaveBeenCalled();
  });

  it("proceeds when auth header is correct", async () => {
    mockGetSchedules.mockResolvedValue([]);
    const res = await GET(makeRequest({ authorization: "Bearer secret123" }));
    expect(res.status).toBe(200);
  });

  it("returns { sent: 0 } when no users are scheduled today", async () => {
    mockGetSchedules.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0 });
  });

  it("sends push notification when user has a push subscription", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: PUSH_SUB.endpoint }),
      expect.any(String)
    );
    expect(body).toEqual({ sent: 1 });
  });

  it("sends the push notification in Hebrew for a he schedule", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);

    await GET(makeRequest());

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.title).toBe(heMessages.Notify.pushTitle);
    expect(payload.body).toContain("08:00");
    expect(payload.body).toContain("45");
  });

  it("sends the push notification in Arabic for an ar schedule", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE_AR]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);

    await GET(makeRequest());

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.title).toBe(arMessages.Notify.pushTitle);
    expect(payload.body).toContain("08:00");
  });

  it("falls back to email when user has no push subscription", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([]); // no push sub

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockEmailSend).toHaveBeenCalled();
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: heMessages.Notify.emailSubject })
    );
    expect(body).toEqual({ sent: 1 });
  });

  it("sends the fallback email in Arabic for an ar schedule", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE_AR]);
    mockGetPushSubs.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: arMessages.Notify.emailSubject })
    );
    const text = mockEmailSend.mock.calls[0][0].text;
    expect(text).toContain(arMessages.Notify.emailGreeting);
    expect(text).toContain(arMessages.Notify.emailGoodLuck);
    expect(body).toEqual({ sent: 1 });
  });

  it("deletes expired push subscription (410) and does not count as sent", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);
    mockSendNotification.mockRejectedValueOnce(
      Object.assign(new Error("410 Gone"), { statusCode: 410 })
    );

    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(admin.from).toHaveBeenCalledWith("user_push_subscriptions");
    expect(reportError).not.toHaveBeenCalled();
    expect(body).toEqual({ sent: 0 });
  });

  it("deletes a gone push subscription (404) as well", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);
    mockSendNotification.mockRejectedValueOnce(
      Object.assign(new Error("404 Not Found"), { statusCode: 404 })
    );

    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(admin.from).toHaveBeenCalledWith("user_push_subscriptions");
    expect(body).toEqual({ sent: 0 });
  });

  it("reports unexpected push failures and keeps the subscription", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);
    const pushError = Object.assign(new Error("500 Internal Server Error"), {
      statusCode: 500,
    });
    mockSendNotification.mockRejectedValueOnce(pushError);

    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(admin.from).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      "notify",
      "push send failed",
      pushError,
      { userId: SCHEDULE.user_id, statusCode: 500 }
    );
    expect(body).toEqual({ sent: 0 });
  });

  it("defaults to Sunday when Intl returns no weekday part", async () => {
    // Intl.DateTimeFormat is called with `new`, so the mock must be a class
    const dtfSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      class {
        constructor() {
          return { formatToParts: () => [] };
        }
      } as never
    );
    try {
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      expect(mockGetSchedules).toHaveBeenCalledWith(expect.anything(), 0);
    } finally {
      dtfSpy.mockRestore();
    }
  });

  it("defaults to day 0 when Intl returns an unknown weekday", async () => {
    const dtfSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      class {
        constructor() {
          return { formatToParts: () => [{ type: "weekday", value: "Xxx" }] };
        }
      } as never
    );
    try {
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      expect(mockGetSchedules).toHaveBeenCalledWith(expect.anything(), 0);
    } finally {
      dtfSpy.mockRestore();
    }
  });

  it("skips email when user has no email address", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([]);

    const admin = makeAdminClient();
    admin.auth.admin.getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: null } },
    });
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(body).toEqual({ sent: 0 });
  });
});

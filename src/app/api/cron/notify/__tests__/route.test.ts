import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { createAdminClient } from "@/lib/supabase";
import { getUsersScheduledForDay, getPushSubscriptionsForUsers } from "@/lib/db";

// vi.hoisted ensures these are initialised before the vi.mock factories run.
const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockEmailSend = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "email-id" }));

vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getUsersScheduledForDay: vi.fn(),
  getPushSubscriptionsForUsers: vi.fn(),
}));
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


function makeRequest(headers: Record<string, string> = {}) {
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

const SCHEDULE = { user_id: "u1", start_time: "08:00:00", duration_minutes: 45 };
const PUSH_SUB = { user_id: "u1", endpoint: "https://push.example.com", auth: "auth", p256dh: "p256" };

describe("GET /api/cron/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    mockCreateAdminClient.mockReturnValue(makeAdminClient() as never);
    mockGetSchedules.mockResolvedValue([]);
    mockGetPushSubs.mockResolvedValue([]);
  });

  it("returns 401 when CRON_SECRET is set and auth header is wrong", async () => {
    process.env.CRON_SECRET = "secret123";
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("proceeds when CRON_SECRET is set and auth header is correct", async () => {
    process.env.CRON_SECRET = "secret123";
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

  it("falls back to email when user has no push subscription", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([]); // no push sub

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(mockEmailSend).toHaveBeenCalled();
    expect(body).toEqual({ sent: 1 });
  });

  it("deletes expired push subscription and does not count as sent", async () => {
    mockGetSchedules.mockResolvedValue([SCHEDULE]);
    mockGetPushSubs.mockResolvedValue([PUSH_SUB]);
    mockSendNotification.mockRejectedValueOnce(new Error("410 Gone"));

    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(admin.from).toHaveBeenCalledWith("user_push_subscriptions");
    expect(body).toEqual({ sent: 0 });
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

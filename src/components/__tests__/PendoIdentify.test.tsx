import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PendoIdentify } from "../PendoIdentify";
import { createClient } from "@/lib/supabase";
import { getPendoVisitor, type PendoVisitor } from "@/lib/pendo";
import { reportError } from "@/lib/monitoring";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/pendo", () => ({ getPendoVisitor: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockGetPendoVisitor = vi.mocked(getPendoVisitor);

const visitor: PendoVisitor = {
  id: "user-1",
  email: "learner@example.com",
  starPoints: 240,
  streakDays: 5,
  lastActiveDate: "2025-03-14",
  targetExamDate: null,
  diagnosticCompletedAt: "2025-03-01T18:30:00+00:00",
  dailyQuestionGoal: 20,
  locale: "he",
  timeZone: "Asia/Jerusalem",
  notify: true,
  dayOfWeek: [0, 2, 4],
  startTime: "18:30:00",
  durationMinutes: 45,
  medalSlug: ["streak-3"],
};

function makeClient(user: { id: string } | null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

async function identifyScript() {
  const element = await PendoIdentify();
  expect(element?.props).toMatchObject({ id: "pendo-identify", strategy: "afterInteractive" });
  return element?.props.children as string;
}

function runScript(script: string) {
  const identify = vi.fn();
  vi.stubGlobal("pendo", { identify });
  eval(script);
  return identify;
}

describe("PendoIdentify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient({ id: "user-1" }) as never);
    mockGetPendoVisitor.mockResolvedValue(visitor);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("identifies the signed-in learner with their visitor metadata", async () => {
    const identify = runScript(await identifyScript());

    expect(identify).toHaveBeenCalledWith({ visitor });
    expect(mockGetPendoVisitor).toHaveBeenCalledWith(expect.anything(), { id: "user-1" });
  });

  it("escapes markup so learner-supplied text cannot close the script", async () => {
    const email = "</script><script>x()</script>@example.com";
    mockGetPendoVisitor.mockResolvedValue({ ...visitor, email });

    const script = await identifyScript();

    expect(script).not.toContain("<");
    expect(runScript(script)).toHaveBeenCalledWith({ visitor: { ...visitor, email } });
  });

  it("resets a stale Pendo identity once the agent loads for signed-out visitors", async () => {
    vi.useFakeTimers();
    mockCreateClient.mockResolvedValue(makeClient(null) as never);

    const element = await PendoIdentify();
    expect(element?.props).toMatchObject({ id: "pendo-reset", strategy: "afterInteractive" });
    expect(mockGetPendoVisitor).not.toHaveBeenCalled();

    // Only the snippet stub exists when the page runs: the reset must wait.
    const clearSession = vi.fn();
    const stub: Record<string, unknown> = {};
    vi.stubGlobal("window", { pendo: stub });
    eval(element?.props.children as string);
    vi.advanceTimersByTime(500);
    expect(clearSession).not.toHaveBeenCalled();

    // The agent finishes loading later, still holding the previous learner.
    stub.clearSession = clearSession;
    stub.isAnonymousVisitor = () => false;
    vi.advanceTimersByTime(100);
    expect(clearSession).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(clearSession).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("leaves an anonymous visitor alone so public pages do not mint new visitors", async () => {
    vi.useFakeTimers();
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const element = await PendoIdentify();

    const clearSession = vi.fn();
    vi.stubGlobal("window", {
      pendo: { clearSession, isAnonymousVisitor: () => true },
    });
    eval(element?.props.children as string);
    vi.advanceTimersByTime(1000);

    expect(clearSession).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not clear the identity when auth is only temporarily unreachable", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { name: "AuthRetryableFetchError", status: 0 },
        }),
      },
    } as never);

    await expect(PendoIdentify()).resolves.toBeNull();
  });

  it("reports a failed lookup and renders nothing, keeping the identity, instead of breaking the page", async () => {
    const error = new Error("getLearnerPlan: user_learner_plans query failed: boom");
    mockGetPendoVisitor.mockRejectedValue(error);

    await expect(PendoIdentify()).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith("pendo", "visitor lookup failed", error);
  });
});

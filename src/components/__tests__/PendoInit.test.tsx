import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PendoInit } from "../PendoInit";
import { createClient } from "@/lib/supabase";
import { getPendoVisitor, type PendoVisitor } from "@/lib/pendo";
import { reportError } from "@/lib/monitoring";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/pendo", () => ({ getPendoVisitor: vi.fn(), PENDO_ACCOUNT_ID: "system" }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockGetPendoVisitor = vi.mocked(getPendoVisitor);

const visitor: PendoVisitor = {
  id: "learner-2",
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

function makeClient(user: { id: string } | null, error: unknown = null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) } };
}

async function initScript() {
  const element = await PendoInit();
  expect(element.props).toMatchObject({ id: "pendo-init", strategy: "afterInteractive" });
  return element.props.children as string;
}

// A model of the documented SDK contract (web-sdk.pendo.io/config/core,
// `forceAnonymous`): the agent keeps whatever the snippet stub queued, emits
// nothing until initialize runs, and on initialize restores a persisted
// identified visitor even for an empty `visitor.id`, unless `forceAnonymous` is
// set. It is not the real agent. `emitted` records the visitor each event is
// attributed to, so a stale attribution shows up as a failed assertion.
function loadAgent(persistedVisitorId: string, script?: string) {
  const emitted: string[] = [];
  const agent = {
    initialize(options: { visitor: { id: string }; forceAnonymous?: boolean }) {
      const persistedIsAnonymous = persistedVisitorId.startsWith("_PENDO_T_");
      const id = options.visitor.id
        ? options.visitor.id
        : options.forceAnonymous && !persistedIsAnonymous
          ? "_PENDO_T_fresh"
          : persistedVisitorId;
      emitted.push(id);
    },
  };
  if (script) {
    vi.stubGlobal("pendo", agent);
    eval(script);
  }
  return { emitted };
}

describe("PendoInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient({ id: "learner-2" }) as never);
    mockGetPendoVisitor.mockResolvedValue(visitor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes the verified learner with their visitor metadata", async () => {
    const script = await initScript();

    expect(script).toBe(
      `pendo.initialize(${JSON.stringify({ visitor, account: { id: "system" } })});`
    );
    expect(mockGetPendoVisitor).toHaveBeenCalledWith(expect.anything(), { id: "learner-2" });
  });

  it("escapes markup so no string in the payload can close the script", async () => {
    const timeZone = "</script><script>x()</script>";
    mockGetPendoVisitor.mockResolvedValue({ ...visitor, timeZone });

    const script = await initScript();

    expect(script).not.toContain("<");
    const initialize = vi.fn();
    vi.stubGlobal("pendo", { initialize });
    eval(script);
    expect(initialize).toHaveBeenCalledWith({
      visitor: { ...visitor, timeZone },
      account: { id: "system" },
    });
  });

  it("still identifies a verified learner by id when the metadata lookup fails", async () => {
    const error = new Error("getLearnerPlan: user_learner_plans query failed: boom");
    mockGetPendoVisitor.mockRejectedValue(error);

    expect(await initScript()).toBe(
      'pendo.initialize({"visitor":{"id":"learner-2"},"account":{"id":"system"}});'
    );
    expect(reportError).toHaveBeenCalledWith("pendo", "visitor lookup failed", error);
  });

  describe("never attributes an event to a previous learner", () => {
    it("starts anonymous with no session at all", async () => {
      mockCreateClient.mockResolvedValue(makeClient(null) as never);
      const script = await initScript();

      expect(script).toBe('pendo.initialize({"visitor":{"id":""},"forceAnonymous":true});');
      expect(mockGetPendoVisitor).not.toHaveBeenCalled();
      expect(loadAgent("learner-1", script).emitted).toEqual(["_PENDO_T_fresh"]);
    });

    it("starts anonymous when the token cookie is expired and getUser rejects it", async () => {
      mockCreateClient.mockResolvedValue(
        makeClient(null, { name: "AuthApiError", status: 401, message: "JWT expired" }) as never
      );
      const script = await initScript();

      expect(loadAgent("learner-1", script).emitted).toEqual(["_PENDO_T_fresh"]);
    });

    it("starts anonymous when only the PKCE code-verifier cookie exists", async () => {
      mockCreateClient.mockResolvedValue(
        makeClient(null, { name: "AuthSessionMissingError", status: 400 }) as never
      );
      const script = await initScript();

      expect(loadAgent("learner-1", script).emitted).toEqual(["_PENDO_T_fresh"]);
    });

    it("starts anonymous when auth is unreachable instead of trusting a persisted visitor", async () => {
      mockCreateClient.mockResolvedValue(
        makeClient(null, { name: "AuthRetryableFetchError", status: 0 }) as never
      );
      const script = await initScript();
      expect(loadAgent("learner-1", script).emitted).toEqual(["_PENDO_T_fresh"]);

      const error = new Error("network down");
      mockCreateClient.mockRejectedValue(error);
      const thrown = await initScript();
      expect(loadAgent("learner-1", thrown).emitted).toEqual(["_PENDO_T_fresh"]);
      expect(reportError).toHaveBeenCalledWith("pendo", "session lookup failed", error);
    });

    it("identifies the new learner directly when someone else was persisted", async () => {
      const script = await initScript();

      expect(loadAgent("learner-1", script).emitted).toEqual(["learner-2"]);
    });

    it("emits nothing until the server-verified initialize runs", () => {
      // The root snippet only installs the stub; before PendoInit's script there
      // is no initialize call, so the agent has nothing to emit as learner-1.
      expect(loadAgent("learner-1").emitted).toEqual([]);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getPendoVisitor } from "../pendo";
import { getLearnerPlan, getUserMedals, getUserSchedule, getUserStats } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getLearnerPlan: vi.fn(),
  getUserMedals: vi.fn(),
  getUserSchedule: vi.fn(),
  getUserStats: vi.fn(),
}));

const supabase = {} as SupabaseClient;

function scheduleRow(id: string, dayOfWeek: number) {
  return {
    id,
    day_of_week: dayOfWeek,
    start_time: "18:30:00",
    duration_minutes: 45,
    notify: true,
    locale: "he" as const,
    time_zone: "Asia/Jerusalem",
  };
}

describe("getPendoVisitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserStats).mockResolvedValue({
      user_id: "user-1",
      star_points: 240,
      streak_days: 5,
      last_active_date: "2025-03-14",
    });
    vi.mocked(getLearnerPlan).mockResolvedValue({
      target_exam_date: "2025-06-01",
      daily_question_goal: 20,
      diagnostic_completed_at: "2025-03-01T18:30:00+00:00",
    });
    vi.mocked(getUserSchedule).mockResolvedValue([
      scheduleRow("s1", 0),
      scheduleRow("s2", 2),
      scheduleRow("s3", 4),
    ]);
    vi.mocked(getUserMedals).mockResolvedValue([
      { medal_slug: "streak-3", earned_at: "2025-03-03T10:00:00+00:00" },
      { medal_slug: "first-topic", earned_at: "2025-03-05T10:00:00+00:00" },
    ]);
  });

  it("maps the learner's account, stats, plan, schedule, and medals", async () => {
    const user = { id: "user-1", email: "learner@example.com" } as User;

    await expect(getPendoVisitor(supabase, user)).resolves.toEqual({
      id: "user-1",
      starPoints: 240,
      streakDays: 5,
      lastActiveDate: "2025-03-14",
      targetExamDate: "2025-06-01",
      diagnosticCompletedAt: "2025-03-01T18:30:00+00:00",
      dailyQuestionGoal: 20,
      locale: "he",
      timeZone: "Asia/Jerusalem",
      notify: true,
      dayOfWeek: [0, 2, 4],
      startTime: "18:30:00",
      durationMinutes: 45,
      medalSlug: ["streak-3", "first-topic"],
    });
    expect(JSON.stringify(await getPendoVisitor(supabase, user))).not.toContain("learner@example.com");
    for (const query of [getUserStats, getLearnerPlan, getUserSchedule, getUserMedals]) {
      expect(query).toHaveBeenCalledWith(supabase, "user-1");
    }
  });

  it("sends nulls and empty lists before a plan, schedule, or medal exists", async () => {
    vi.mocked(getUserStats).mockResolvedValue({
      user_id: "user-2",
      star_points: 0,
      streak_days: 0,
      last_active_date: null,
    });
    vi.mocked(getLearnerPlan).mockResolvedValue(null);
    vi.mocked(getUserSchedule).mockResolvedValue([]);
    vi.mocked(getUserMedals).mockResolvedValue([]);

    await expect(getPendoVisitor(supabase, { id: "user-2" } as User)).resolves.toEqual({
      id: "user-2",
      starPoints: 0,
      streakDays: 0,
      lastActiveDate: null,
      targetExamDate: null,
      diagnosticCompletedAt: null,
      dailyQuestionGoal: null,
      locale: null,
      timeZone: null,
      notify: null,
      dayOfWeek: [],
      startTime: null,
      durationMinutes: null,
      medalSlug: [],
    });
  });

  it("sends zero for star points and streak days that are NULL in the database", async () => {
    vi.mocked(getUserStats).mockResolvedValue({
      user_id: "user-1",
      star_points: null,
      streak_days: null,
      last_active_date: null,
    } as unknown as Awaited<ReturnType<typeof getUserStats>>);

    const visitor = await getPendoVisitor(supabase, { id: "user-1" } as User);

    expect(visitor.starPoints).toBe(0);
    expect(visitor.streakDays).toBe(0);
  });

  it("sends schedule metadata only when every scheduled day agrees", async () => {
    vi.mocked(getUserSchedule).mockResolvedValue([
      scheduleRow("s1", 0),
      { ...scheduleRow("s2", 2), start_time: "07:00:00", notify: false },
      { ...scheduleRow("s3", 4), time_zone: "Europe/London", duration_minutes: 30 },
    ]);

    const visitor = await getPendoVisitor(supabase, { id: "user-1" } as User);

    expect(visitor).toMatchObject({
      dayOfWeek: [0, 2, 4],
      locale: "he",
      startTime: null,
      notify: null,
      timeZone: null,
      durationMinutes: null,
    });
  });
});

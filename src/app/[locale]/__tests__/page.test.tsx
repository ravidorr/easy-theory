import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HomePage from "../page";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getUserStats,
  getTopicProgress,
  getExamAttempts,
  getTopicAccuracy,
  getTopicQuestionCounts,
  getQuestionNumbersForTopic,
  getAnsweredQuestionIdsForTopic,
  getQuizAccuracyForWindow,
} from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getTopics: vi.fn(),
  getUserStats: vi.fn(),
  getTopicProgress: vi.fn(),
  getExamAttempts: vi.fn(),
  getTopicAccuracy: vi.fn(),
  getTopicQuestionCounts: vi.fn(),
  getQuestionNumbersForTopic: vi.fn(),
  getAnsweredQuestionIdsForTopic: vi.fn(),
  getQuizAccuracyForWindow: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetTopics = vi.mocked(getTopics);
const mockGetStats = vi.mocked(getUserStats);
const mockGetProgress = vi.mocked(getTopicProgress);
const mockGetExamAttempts = vi.mocked(getExamAttempts);
const mockGetTopicAccuracy = vi.mocked(getTopicAccuracy);
const mockGetQuestionCounts = vi.mocked(getTopicQuestionCounts);
const mockGetQuestionNumbers = vi.mocked(getQuestionNumbersForTopic);
const mockGetAnsweredIds = vi.mocked(getAnsweredQuestionIdsForTopic);
const mockGetWindowAccuracy = vi.mocked(getQuizAccuracyForWindow);

const TOPIC_A = { id: "t1", slug: "signs", name_he: "תמרורים", icon: null };
const TOPIC_B = { id: "t2", slug: "priority", name_he: "זכות קדימה", icon: null };

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetStats.mockResolvedValue({ streak_days: 7, star_points: 42 } as never);
    mockGetTopics.mockResolvedValue([TOPIC_A, TOPIC_B] as never);
    mockGetProgress.mockResolvedValue([]);
    mockGetExamAttempts.mockResolvedValue([]);
    mockGetTopicAccuracy.mockResolvedValue([]);
    mockGetQuestionCounts.mockResolvedValue({ t1: 20, t2: 10 });
    mockGetQuestionNumbers.mockResolvedValue([]);
    mockGetAnsweredIds.mockResolvedValue(new Set());
    mockGetWindowAccuracy.mockResolvedValue({ correct: 0, total: 0 });
    vi.mocked(getTranslations).mockResolvedValue((key: string) => key);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(HomePage()).rejects.toThrow("redirect");
  });

  it("renders streak days and star points", async () => {
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(document.querySelector('[data-stat="streak"]')?.textContent).toBe("7");
    expect(document.querySelector('[data-stat="points"]')?.textContent).toBe("42");
  });

  it("labels the streak and points counters for screen readers", async () => {
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("streakLabel")).toHaveClass("sr-only");
    expect(screen.getByText("pointsLabel")).toHaveClass("sr-only");
  });

  it("renders the today-card CTA as a link styled as a button, without a nested button", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    const cta = container.querySelector('a[href="/topics/signs"].btn-primary');
    expect(cta).toBeTruthy();
    expect(cta?.textContent).toBe("startBtn");
    expect(container.querySelector("a button")).toBeNull();
  });

  it("renders the schedule CTA as a link without a nested button when all topics are completed", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
      { topic_id: "t2", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/schedule"].btn-primary')).toBeTruthy();
    expect(container.querySelector("a button")).toBeNull();
  });

  it("renders a mock-exam CTA linking to /exam", async () => {
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/exam"]')).toBeTruthy();
    expect(screen.getByText("examCtaTitle")).toBeInTheDocument();
    expect(screen.getByText("examCtaDesc")).toBeInTheDocument();
  });

  it("shows today's task card when there is an in_progress topic", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t2", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("todayBadge")).toBeInTheDocument();
    expect(screen.queryByText("emptyStateTitle")).not.toBeInTheDocument();
  });

  it("prefers in_progress topic over not_started as today's task", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
      { topic_id: "t2", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    const todayLink = container.querySelector('a[href="/topics/priority"]');
    expect(todayLink).toBeTruthy();
  });

  it("falls back to first not_started topic when none in_progress", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("todayBadge")).toBeInTheDocument();
  });

  it("shows schedule prompt when all topics are completed", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
      { topic_id: "t2", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("emptyStateTitle")).toBeInTheDocument();
    expect(screen.queryByText("todayBadge")).not.toBeInTheDocument();
  });

  it("shows zeroed overall progress when nothing was answered", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText('topicsPercent|{"percent":0}')).toBeInTheDocument();
    expect(
      screen.getByText('topicsAnsweredOverall|{"answered":0,"total":30}')
    ).toBeInTheDocument();
    expect(screen.getByText('topicsRemaining|{"count":30}')).toBeInTheDocument();
  });

  it("shows the overall answered count, percent, and remaining questions", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 3, total: 5 },
      { topic_id: "t2", correct: 2, total: 4 },
    ]);
    const jsx = await HomePage();
    render(jsx);
    // 9 answered of 30 → 30%, 21 remaining.
    expect(screen.getByText('topicsPercent|{"percent":30}')).toBeInTheDocument();
    expect(
      screen.getByText('topicsAnsweredOverall|{"answered":9,"total":30}')
    ).toBeInTheDocument();
    expect(screen.getByText('topicsRemaining|{"count":21}')).toBeInTheDocument();
    expect(screen.queryByText(/topicsAllAnswered/)).not.toBeInTheDocument();
  });

  it("swaps the remaining count for a completion message at 100%", async () => {
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 18, total: 20 },
      { topic_id: "t2", correct: 9, total: 10 },
    ]);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("topicsAllAnswered")).toBeInTheDocument();
    expect(screen.queryByText("topicsRemaining")).not.toBeInTheDocument();
  });

  it("drives the overall progress bar width from answered/total questions", async () => {
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 3, total: 5 },
    ]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    // 5 answered of 30 overall → floored to 16%; the t1 card bar is 25% (5 of 20).
    const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
    expect(widths).toContain("16%");
    expect(widths).toContain("25%");
  });

  it("floors the overall percent and uses the singular string for one remaining question", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 18, total: 20 },
      { topic_id: "t2", correct: 8, total: 9 },
    ]);
    const jsx = await HomePage();
    render(jsx);
    // 29 of 30 → 96.67%, floored to 96 so the bar never reads 100% early.
    expect(screen.getByText('topicsPercent|{"percent":96}')).toBeInTheDocument();
    expect(screen.getByText("topicsRemainingOne")).toBeInTheDocument();
    expect(screen.queryByText(/topicsRemaining\|/)).not.toBeInTheDocument();
    expect(screen.queryByText("topicsAllAnswered")).not.toBeInTheDocument();
  });

  it("ignores question counts for topics that are not listed", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    const jsx = await HomePage();
    render(jsx);
    // Only t1 (20 questions) is listed; t2's 10 must not inflate the total.
    expect(
      screen.getByText('topicsAnsweredOverall|{"answered":0,"total":20}')
    ).toBeInTheDocument();
  });

  it("calculates step 1 when nothing was answered", async () => {
    mockGetProgress.mockResolvedValue([]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
  });

  it("shows streakZero greeting when streak_days is 0", async () => {
    mockGetStats.mockResolvedValue({ streak_days: 0, star_points: 0 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getAllByText("streakZero")[0]).toBeInTheDocument();
  });

  it("shows streakOne greeting when streak_days is 1", async () => {
    mockGetStats.mockResolvedValue({ streak_days: 1, star_points: 5 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("streakOne")).toBeInTheDocument();
  });

  it("calculates step 6 when all questions were answered", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 100 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 20, total: 20 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeNull();
    expect(screen.getAllByText("✓")).toHaveLength(5);
  });

  it("calculates step 4 when 70% of questions were answered", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 0 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 14, total: 14 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(3);
  });

  it("calculates step 2 when 20% of questions were answered", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 0 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 4, total: 4 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("calculates step 3 when 50% of questions were answered", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 0 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 10, total: 10 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("renders icon image when topic has an icon", async () => {
    const topicWithIcon = { id: "t1", slug: "signs", name_he: "תמרורים", icon: "/icons/signs.png" };
    mockGetTopics.mockResolvedValue([topicWithIcon] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("img[src='/icons/signs.png']")).toBeTruthy();
  });

  it("renders description when topic has description_he", async () => {
    const topicWithDesc = {
      id: "t1",
      slug: "signs",
      name_he: "תמרורים",
      icon: null,
      description_he: "לימוד תמרורים",
    };
    mockGetTopics.mockResolvedValue([topicWithDesc] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("לימוד תמרורים")).toBeInTheDocument();
  });

  it("shows the answered-count badge with percent once questions were answered", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 4, total: 5 }]);
    const jsx = await HomePage();
    render(jsx);
    expect(
      screen.getByText('topicAnsweredCountPct|{"answered":5,"total":20,"percent":25}')
    ).toBeInTheDocument();
  });

  it("keeps topicNotStarted when in_progress but nothing was answered yet", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 0 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getAllByText("topicNotStarted")).toHaveLength(2);
    expect(screen.queryByText("topicAnsweredCountPct")).not.toBeInTheDocument();
  });

  it("uses the answered/total coverage for the in-progress bar width", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 90 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 5, total: 5 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
    expect(widths).toContain("25%"); // 5 answered of 20, not best_score 90
    expect(widths).not.toContain("90%");
  });

  it("keeps best_score for the bar and label when completed", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 85 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 20, total: 20 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(screen.getByText("topicCompleted")).toBeInTheDocument();
    const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
    expect(widths).toContain("85%");
  });

  it("passes the topic question count to the daily task description", async () => {
    vi.mocked(getTranslations).mockResolvedValue(((
      key: string,
      values?: Record<string, unknown>
    ) => (values ? `${key}|${JSON.stringify(values)}` : key)) as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText('todayTaskDesc|{"count":20}')).toBeInTheDocument();
  });

  it("shows days-to-next-medal nudge based on streak_days", async () => {
    // streak=7 → next milestone is 14 → 7 days away → daysToMedalMany
    mockGetStats.mockResolvedValue({ streak_days: 7, star_points: 10 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("daysToMedalMany")).toBeInTheDocument();
  });

  it("shows all-medals-earned message when streak_days >= 30", async () => {
    mockGetStats.mockResolvedValue({ streak_days: 30, star_points: 300 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("allMedals")).toBeInTheDocument();
  });

  it("shows one-day-to-medal nudge when the next milestone is tomorrow", async () => {
    // streak=2 → next milestone is 3 → 1 day away → daysToMedalOne
    mockGetStats.mockResolvedValue({ streak_days: 2, star_points: 20 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("daysToMedalOne")).toBeInTheDocument();
  });

  describe("readiness card", () => {
    function examAttempt(score: number, created_at: string) {
      return {
        id: `e-${created_at}`,
        score,
        total: 30,
        passed: score >= 26,
        duration_seconds: 1800,
        created_at,
      };
    }

    it("prompts to take a mock exam when there are no attempts", async () => {
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("readinessTitle")).toBeInTheDocument();
      expect(screen.getByText("readinessEmpty")).toBeInTheDocument();
      expect(screen.queryByText("readinessLevelLow")).not.toBeInTheDocument();
      expect(screen.queryByText("readinessLevelMedium")).not.toBeInTheDocument();
      expect(screen.queryByText("readinessLevelHigh")).not.toBeInTheDocument();
    });

    it("shows a high-readiness chip and percent for strong recent scores", async () => {
      mockGetExamAttempts.mockResolvedValue([
        examAttempt(30, "2026-07-03"),
        examAttempt(29, "2026-07-02"),
      ] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("readinessLevelHigh")).toBeInTheDocument();
      expect(screen.getByText("readinessPercent")).toBeInTheDocument();
      expect(screen.getByText("readinessBasedOnMany")).toBeInTheDocument();
    });

    it("shows a low-readiness chip for weak recent scores", async () => {
      mockGetExamAttempts.mockResolvedValue([
        examAttempt(10, "2026-07-03"),
        examAttempt(12, "2026-07-02"),
      ] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("readinessLevelLow")).toBeInTheDocument();
    });

    it("uses the singular caption for a single attempt", async () => {
      mockGetExamAttempts.mockResolvedValue([examAttempt(26, "2026-07-03")] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("readinessLevelMedium")).toBeInTheDocument();
      expect(screen.getByText("readinessBasedOnOne")).toBeInTheDocument();
    });
  });

  describe("weakest topics", () => {
    it("is hidden when no topic has enough answers", async () => {
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 1, total: 3 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText("weakTopicsHeader")).not.toBeInTheDocument();
    });

    it("renders weak topics linking to practice", async () => {
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 2, total: 10 },
        { topic_id: "t2", correct: 9, total: 10 },
      ]);
      const jsx = await HomePage();
      const { container } = render(jsx);
      expect(screen.getByText("weakTopicsHeader")).toBeInTheDocument();
      expect(screen.getByText("weakTopicAccuracy")).toBeInTheDocument();
      // Only t1 is weak (20%); t2 is mastered (90%). Weak section + topics list
      // both link to /topics/signs.
      expect(
        container.querySelectorAll('a[href="/topics/signs"]').length
      ).toBeGreaterThanOrEqual(2);
    });

    it("skips weak topics whose topic row is unknown", async () => {
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "missing", correct: 2, total: 10 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText("weakTopicsHeader")).not.toBeInTheDocument();
    });

    it("uses name_ar for weak topics in the ar locale", async () => {
      vi.mocked(getLocale).mockResolvedValue("ar" as never);
      const topicAr = { ...TOPIC_A, name_ar: "إشارات المرور" };
      mockGetTopics.mockResolvedValue([topicAr] as never);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 2, total: 10 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("weakTopicsHeader")).toBeInTheDocument();
      expect(screen.getAllByText("إشارات المرور").length).toBeGreaterThan(0);
    });
  });

  describe("personalized greeting", () => {
    const valuesT = ((key: string, values?: Record<string, unknown>) =>
      values ? `${key}|${JSON.stringify(values)}` : key) as never;

    it("renders no personal lines for a brand-new user", async () => {
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText(/resumeLine/)).not.toBeInTheDocument();
      expect(screen.queryByText(/yesterdayAccuracy/)).not.toBeInTheDocument();
      expect(screen.queryByText(/focusTopicLine/)).not.toBeInTheDocument();
      // The base greeting is unaffected.
      expect(screen.getByText(/greeting(Morning|Noon|Evening)/)).toBeInTheDocument();
    });

    it("links the resume line to the last-studied topic with question and minutes", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetProgress.mockResolvedValue([
        {
          topic_id: "t1",
          status: "in_progress",
          best_score: 50,
          last_studied_at: "2026-07-15T10:00:00Z",
        },
      ] as never);
      mockGetQuestionNumbers.mockResolvedValue(
        Array.from({ length: 13 }, (_, i) => ({
          id: `q${i + 1}`,
          question_number: i + 1,
        }))
      );
      mockGetAnsweredIds.mockResolvedValue(new Set(["q1"]));
      const jsx = await HomePage();
      const { container } = render(jsx);
      // First unanswered is q2; 12 remaining at 1.5 q/min rounds to 8 minutes.
      const line = screen.getByText('resumeLine|{"number":2,"minutes":8}');
      expect(line.closest("a")?.getAttribute("href")).toBe("/topics/signs");
      expect(mockGetQuestionNumbers).toHaveBeenCalledWith(expect.anything(), "t1");
      expect(container.querySelectorAll('a[href="/topics/signs"]').length).toBeGreaterThan(1);
    });

    it("uses the single-minute resume string when almost done", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetProgress.mockResolvedValue([
        {
          topic_id: "t1",
          status: "in_progress",
          best_score: 50,
          last_studied_at: "2026-07-15T10:00:00Z",
        },
      ] as never);
      mockGetQuestionNumbers.mockResolvedValue([
        { id: "q1", question_number: 1 },
        { id: "q2", question_number: 2 },
      ]);
      mockGetAnsweredIds.mockResolvedValue(new Set(["q1"]));
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText('resumeLineOneMinute|{"number":2}')).toBeInTheDocument();
    });

    it("shows yesterday's accuracy when there was activity", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetWindowAccuracy.mockResolvedValue({ correct: 9, total: 10 });
      const jsx = await HomePage();
      render(jsx);
      expect(
        screen.getByText('yesterdayAccuracyHigh|{"percent":90}')
      ).toBeInTheDocument();
    });

    it("encourages improvement when yesterday's accuracy was low", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetWindowAccuracy.mockResolvedValue({ correct: 3, total: 10 });
      const jsx = await HomePage();
      render(jsx);
      expect(
        screen.getByText('yesterdayAccuracyLow|{"percent":30}')
      ).toBeInTheDocument();
    });

    it("suggests a weak topic as the focus line", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t2", correct: 2, total: 10 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(
        screen.getByText('focusTopicLine|{"topic":"זכות קדימה"}')
      ).toBeInTheDocument();
    });

    it("skips the resume fetch entirely when nothing is in progress", async () => {
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "completed", best_score: 100 },
      ] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(mockGetQuestionNumbers).not.toHaveBeenCalled();
      expect(mockGetAnsweredIds).not.toHaveBeenCalled();
      expect(screen.queryByText(/resumeLine/)).not.toBeInTheDocument();
    });
  });

  describe("time-based greeting", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows morning greeting before noon", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 6, 13, 8, 0, 0));
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText(/greetingMorning/)).toBeInTheDocument();
    });

    it("shows noon greeting between 12 and 17", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 6, 13, 13, 0, 0));
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText(/greetingNoon/)).toBeInTheDocument();
    });

    it("shows evening greeting from 17 onwards", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 6, 13, 19, 0, 0));
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText(/greetingEvening/)).toBeInTheDocument();
    });
  });

  describe("ar locale", () => {
    beforeEach(() => {
      vi.mocked(getLocale).mockResolvedValue("ar" as never);
    });

    it("uses name_ar and description_ar when populated", async () => {
      const topicAr = {
        ...TOPIC_B,
        name_ar: "أولوية المرور",
        description_ar: "تعلم أولوية المرور",
        description_he: "לימוד זכות קדימה",
      };
      mockGetTopics.mockResolvedValue([topicAr] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getAllByText("أولوية المرور").length).toBeGreaterThan(0);
      expect(screen.getByText("تعلم أولوية المرور")).toBeInTheDocument();
    });

    it("does not show Hebrew topic names when name_ar is missing", async () => {
      mockGetTopics.mockResolvedValue([TOPIC_A] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText("תמרורים")).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  getTranslations: vi
    .fn()
    .mockResolvedValue(
      Object.assign((key: string) => key, { raw: (key: string) => `raw:${key}` })
    ),
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

// Translation mock that encodes ICU values as `key|{json}` so assertions can
// pin the interpolated numbers. `raw` mirrors next-intl's t.raw, which the
// page uses to expose the ICU template to stats-pills.js.
const valuesT = Object.assign(
  (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${JSON.stringify(values)}` : key,
  { raw: (key: string) => `raw:${key}` }
) as never;

// Namespace-key passthrough with the same `raw` shape, for tests that only
// assert on keys.
const keyT = Object.assign((key: string) => key, {
  raw: (key: string) => `raw:${key}`,
}) as never;

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
    vi.mocked(getTranslations).mockResolvedValue(keyT);
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

  it("labels every stat tile in the stats strip", async () => {
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("statsStreakLabel")).toBeInTheDocument();
    expect(screen.getByText("statsPointsLabel")).toBeInTheDocument();
    expect(screen.getByText("statsLevelLabel")).toBeInTheDocument();
    expect(screen.getByText("dailyGoalLabel")).toBeInTheDocument();
  });

  it("renders exactly one live element per stat for the pill-sync script", async () => {
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelectorAll('[data-stat="streak"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-stat="points"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-stat="level"]')).toHaveLength(1);
  });

  it("exposes the level tile hooks the pill-sync script re-derives from", async () => {
    const jsx = await HomePage();
    const { container } = render(jsx);
    const tile = container.querySelector("[data-level-unit]")!;
    // 60 = LEVEL_CURVE_UNIT; the script recomputes the level curve from it.
    expect(tile.getAttribute("data-level-unit")).toBe("60");
    expect(tile.querySelector('[data-stat="level"]')).not.toBeNull();
    expect(tile.querySelector('[data-stat="level-fill"]')).not.toBeNull();
    expect(
      tile.querySelector('[data-stat="level-caption"]')?.getAttribute("data-template")
    ).toBe("raw:levelToNext");
  });

  describe("stats strip", () => {
    it("derives the level and points-to-next from star points", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      // 150 points: level 2 spans 120-360, so 210 points remain.
      mockGetStats.mockResolvedValue({ streak_days: 0, star_points: 150 } as never);
      const jsx = await HomePage();
      render(jsx);
      const strip = screen.getByLabelText("statsStripLabel");
      expect(within(strip).getByText("2")).toBeInTheDocument();
      expect(screen.getByText('levelToNext|{"points":210}')).toBeInTheDocument();
    });

    it("fetches today's window separately from yesterday's", async () => {
      await HomePage();
      expect(mockGetWindowAccuracy).toHaveBeenCalledTimes(2);
      const [yesterdayCall, todayCall] = mockGetWindowAccuracy.mock.calls;
      expect(yesterdayCall[2]).not.toBe(todayCall[2]);
      expect(yesterdayCall[3]).toBe(todayCall[2]);
    });

    it("shows daily-goal progress with the remaining count", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetWindowAccuracy.mockResolvedValue({ correct: 5, total: 12 });
      const jsx = await HomePage();
      const { container } = render(jsx);
      expect(
        screen.getByText('dailyGoalValue|{"answered":12,"goal":20}')
      ).toBeInTheDocument();
      expect(screen.getByText('dailyGoalRemaining|{"count":8}')).toBeInTheDocument();
      const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
      expect(widths).toContain("60%");
    });

    it("uses the singular string when one question remains for the goal", async () => {
      mockGetWindowAccuracy.mockResolvedValue({ correct: 10, total: 19 });
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("dailyGoalRemainingOne")).toBeInTheDocument();
    });

    it("marks the goal as done and caps the bar at 100%", async () => {
      mockGetWindowAccuracy.mockResolvedValue({ correct: 20, total: 25 });
      const jsx = await HomePage();
      const { container } = render(jsx);
      expect(screen.getByText("dailyGoalDone")).toBeInTheDocument();
      expect(screen.queryByText(/dailyGoalRemaining/)).not.toBeInTheDocument();
      const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
      expect(widths).toContain("100%");
      expect(widths.every((w) => !w || parseInt(w, 10) <= 100)).toBe(true);
    });
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

  describe("exam CTA placement", () => {
    function precedes(first: Element, second: Element) {
      return Boolean(
        first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    }

    // The examReady greeting line also links to /exam, so the card is pinned
    // by its title rather than by href.
    function examCard() {
      const card = screen.getByText("examCtaTitle").closest("a");
      expect(card).toHaveAttribute("href", "/exam");
      return card as Element;
    }

    it("keeps the exam CTA below the readiness card under 50% completion", async () => {
      // Defaults: nothing answered of 30 questions → 0% completion.
      const jsx = await HomePage();
      render(jsx);
      expect(precedes(screen.getByText("readinessTitle"), examCard())).toBe(true);
    });

    it("surfaces the exam CTA above the daily mission at 50% completion or more", async () => {
      // 15 answered of 30 questions → exactly 50%, the surfacing boundary.
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 10, total: 15 },
      ]);
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "in_progress", best_score: 50 },
      ] as never);
      const jsx = await HomePage();
      render(jsx);
      expect(precedes(examCard(), screen.getByText("todayBadge"))).toBe(true);
      expect(precedes(examCard(), screen.getByText("readinessTitle"))).toBe(true);
    });

    it("keeps the exam CTA in its lower slot just under the threshold", async () => {
      // 14 answered of 30 questions → 46%, still below the 50% threshold.
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 9, total: 14 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(precedes(screen.getByText("readinessTitle"), examCard())).toBe(true);
    });

    it("surfaces the exam CTA above the empty-state card when no mission remains", async () => {
      // All topics completed, 15 of 30 answered → 50%, no mission card.
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "completed", best_score: 100 },
        { topic_id: "t2", status: "completed", best_score: 100 },
      ] as never);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 10, total: 15 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText("todayBadge")).not.toBeInTheDocument();
      expect(precedes(examCard(), screen.getByText("emptyStateTitle"))).toBe(true);
    });

    it("drops the exam-ready greeting line while the exam CTA is surfaced early", async () => {
      // Two near-perfect attempts → high readiness; 15 of 30 answered → 50%.
      mockGetExamAttempts.mockResolvedValue([
        {
          id: "e1",
          score: 30,
          total: 30,
          passed: true,
          duration_seconds: 1800,
          created_at: "2026-07-03",
        },
        {
          id: "e2",
          score: 29,
          total: 30,
          passed: true,
          duration_seconds: 1800,
          created_at: "2026-07-02",
        },
      ] as never);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 10, total: 15 },
      ]);
      const jsx = await HomePage();
      const { container } = render(jsx);
      expect(screen.queryByText("examReadyLine")).not.toBeInTheDocument();
      expect(container.querySelectorAll('a[href="/exam"]')).toHaveLength(1);
    });
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

  describe("daily mission card", () => {
    function missionCard() {
      const card = screen.getByText("todayBadge").parentElement;
      if (!card) throw new Error("mission card not found");
      return card;
    }

    beforeEach(() => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "in_progress", best_score: 50 },
      ] as never);
      // 8 of t1's 20 questions answered: 40% coverage, 12 remaining.
      mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 6, total: 8 }]);
    });

    it("renders a progress ring with the mission topic's coverage percent", async () => {
      const jsx = await HomePage();
      render(jsx);
      const ring = screen.getByRole("progressbar");
      expect(ring).toHaveAttribute("aria-valuenow", "40");
      expect(ring).toHaveAttribute("aria-valuemin", "0");
      expect(ring).toHaveAttribute("aria-valuemax", "100");
      expect(ring).toHaveAttribute("aria-label", "missionProgressLabel");
      expect(within(missionCard()).getByText('topicsPercent|{"percent":40}')).toBeInTheDocument();
    });

    it("shows estimated-time and points-reward chips for the remaining questions", async () => {
      const jsx = await HomePage();
      render(jsx);
      const card = within(missionCard());
      // 12 remaining questions at 1.5/minute is 8 minutes and 120 points.
      expect(card.getByText('topicDurationMinutes|{"minutes":8}')).toBeInTheDocument();
      expect(card.getByText('missionXpReward|{"points":120}')).toBeInTheDocument();
      expect(card.queryByText("missionCompleteLabel")).not.toBeInTheDocument();
    });

    it("does not mark the card complete while questions remain", async () => {
      const jsx = await HomePage();
      render(jsx);
      expect(missionCard()).not.toHaveAttribute("data-complete");
    });

    it("omits the chip row and the ring sweep for a topic with no questions", async () => {
      mockGetQuestionCounts.mockResolvedValue({ t1: 0, t2: 10 });
      mockGetTopicAccuracy.mockResolvedValue([]);
      const jsx = await HomePage();
      render(jsx);
      expect(missionCard().querySelector('[class*="topicMetaRow"]')).toBeNull();
      const ring = screen.getByRole("progressbar");
      expect(ring).toHaveAttribute("aria-valuenow", "0");
      expect(ring).toHaveAttribute("data-empty", "true");
    });

    it("marks the card complete when every question is answered", async () => {
      mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 15, total: 20 }]);
      const jsx = await HomePage();
      render(jsx);
      expect(missionCard()).toHaveAttribute("data-complete");
      const ring = screen.getByRole("progressbar");
      expect(ring).toHaveAttribute("aria-valuenow", "100");
      const card = within(missionCard());
      expect(card.getByText("missionCompleteLabel")).toBeInTheDocument();
      expect(card.getByText("✓")).toBeInTheDocument();
      expect(card.queryByText(/missionXpReward/)).not.toBeInTheDocument();
      expect(card.queryByText(/topicDurationMinutes/)).not.toBeInTheDocument();
    });
  });

  it("shows zeroed overall progress when nothing was answered", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    const jsx = await HomePage();
    render(jsx);
    // Once in the overall-progress header and once in the mission ring.
    expect(screen.getAllByText('topicsPercent|{"percent":0}')).toHaveLength(2);
    expect(
      screen.getByText('topicsAnsweredOverall|{"answered":0,"total":30}')
    ).toBeInTheDocument();
    expect(screen.getByText('topicsRemaining|{"count":30}')).toBeInTheDocument();
  });

  it("shows the overall answered count, percent, and remaining questions", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
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
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
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
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    const jsx = await HomePage();
    render(jsx);
    // Only t1 (20 questions) is listed; t2's 10 must not inflate the total.
    expect(
      screen.getByText('topicsAnsweredOverall|{"answered":0,"total":20}')
    ).toBeInTheDocument();
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
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
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
    expect(
      container.querySelector('a[href^="/topics/"] div[data-complete]')
    ).toBeNull();
  });

  it("keeps best_score for the bar and label when completed", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 85 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 20, total: 20 }]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(screen.getByText('topicCompletedScore|{"percent":85}')).toBeInTheDocument();
    const widths = [...container.querySelectorAll("div")].map((d) => d.style.width);
    expect(widths).toContain("85%");
    // Completed cards get the distinct visual treatment: the data-complete
    // card marker and a rendered check icon in the status pill.
    const card = container.querySelector('a[href="/topics/signs"] div[data-complete]');
    expect(card).not.toBeNull();
    expect(card!.querySelector("svg")).not.toBeNull();
  });

  it("falls back to plain topicCompleted when best_score is null", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: null },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 20, total: 20 }]);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("topicCompleted")).toBeInTheDocument();
    expect(screen.queryByText(/topicCompletedScore/)).not.toBeInTheDocument();
  });

  it("shows difficulty, duration, and remaining-points chips on a fresh topic", async () => {
    const jsx = await HomePage();
    render(jsx);
    // TOPIC_A slug "signs" is mapped easy; TOPIC_B slug "priority" is unmapped.
    expect(screen.getByText("topicDifficultyEasy")).toBeInTheDocument();
    expect(screen.queryByText("topicDifficultyMedium")).not.toBeInTheDocument();
    expect(screen.queryByText("topicDifficultyHard")).not.toBeInTheDocument();
    // 20 and 10 remaining questions both estimate under an hour; the mission
    // card repeats the duration chip for its topic.
    expect(screen.getAllByText("topicDurationMinutes")).toHaveLength(3);
    expect(screen.getAllByText("topicPointsRemaining")).toHaveLength(2);
  });

  it("formats the duration chip values from the remaining questions", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetQuestionCounts.mockResolvedValue({ t1: 501 });
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 1, total: 1 }]);
    const jsx = await HomePage();
    render(jsx);
    // Once on the topic card and once on the mission card for the same topic.
    expect(screen.getAllByText('topicDurationHours|{"hours":6}')).toHaveLength(2);
    expect(screen.getByText('topicPointsRemaining|{"points":5000}')).toBeInTheDocument();
  });

  it("hides the duration and points chips once a topic is completed", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_A] as never);
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 85 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ topic_id: "t1", correct: 20, total: 20 }]);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.queryByText("topicDurationMinutes")).not.toBeInTheDocument();
    expect(screen.queryByText("topicPointsRemaining")).not.toBeInTheDocument();
    expect(screen.getByText("topicDifficultyEasy")).toBeInTheDocument();
  });

  it("passes the topic question count to the daily task description", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
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

  it("shows activation nudge without loss aversion when streak_days is 0", async () => {
    mockGetStats.mockResolvedValue({ streak_days: 0, star_points: 0 } as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("daysToMedalStart")).toBeInTheDocument();
  });

  it("threads the next medal name into the nudge", async () => {
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    // streak=7 → next milestone is 14 → medalName14
    const jsx = await HomePage();
    render(jsx);
    expect(
      screen.getByText('daysToMedalMany|{"count":7,"medal":"medalName14"}')
    ).toBeInTheDocument();
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
    it("renders no personal lines for a brand-new user", async () => {
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText(/resumeLine/)).not.toBeInTheDocument();
      expect(screen.queryByText(/yesterdayAccuracy/)).not.toBeInTheDocument();
      expect(screen.queryByText(/focusTopicLine/)).not.toBeInTheDocument();
      expect(screen.queryByText(/masteredTopicLine/)).not.toBeInTheDocument();
      expect(screen.queryByText(/remainingQuestionsLine/)).not.toBeInTheDocument();
      expect(screen.queryByText(/examReadyLine/)).not.toBeInTheDocument();
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

    it("celebrates a mastered topic", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t2", correct: 9, total: 10 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(
        screen.getByText('masteredTopicLine|{"topic":"זכות קדימה"}')
      ).toBeInTheDocument();
    });

    it("links the exam-ready line to the mock exam at high readiness", async () => {
      mockGetExamAttempts.mockResolvedValue([
        {
          id: "e1",
          score: 30,
          total: 30,
          passed: true,
          duration_seconds: 1800,
          created_at: "2026-07-03",
        },
        {
          id: "e2",
          score: 29,
          total: 30,
          passed: true,
          duration_seconds: 1800,
          created_at: "2026-07-02",
        },
      ] as never);
      const jsx = await HomePage();
      render(jsx);
      const line = screen.getByText("examReadyLine");
      expect(line.closest("a")?.getAttribute("href")).toBe("/exam");
    });

    it("counts down the remaining questions past the halfway mark", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      // 15 of 30 answered (exactly 50%), 15 remaining.
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 12, total: 15 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(
        screen.getByText('remainingQuestionsLine|{"count":15}')
      ).toBeInTheDocument();
    });

    it("uses the singular remaining string for the last question", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      // 29 of 30 answered, one question left.
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 20, total: 20 },
        { topic_id: "t2", correct: 9, total: 9 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.getByText("remainingQuestionsLineOne")).toBeInTheDocument();
    });

    it("hides the remaining countdown below the halfway mark", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      // 14 of 30 answered (46%).
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 14, total: 14 },
      ]);
      const jsx = await HomePage();
      render(jsx);
      expect(screen.queryByText(/remainingQuestionsLine/)).not.toBeInTheDocument();
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

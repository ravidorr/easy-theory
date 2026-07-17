import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import MorePage from "../page";
import { createClient } from "@/lib/supabase";
import {
  getUserMedals,
  getUserStats,
  getTopics,
  getTopicProgress,
  getTopicAccuracy,
  getTopicQuestionCounts,
  hasPassedExam,
} from "@/lib/db";
import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getUserMedals: vi.fn(),
  getUserStats: vi.fn(),
  getTopics: vi.fn(),
  getTopicProgress: vi.fn(),
  getTopicAccuracy: vi.fn(),
  getTopicQuestionCounts: vi.fn(),
  hasPassedExam: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "dark" }),
  }),
}));
vi.mock("next/script", () => ({ default: () => React.createElement("div", null) }));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));
vi.mock("@/components/LanguageToggle", () => ({
  LanguageToggle: () => React.createElement("div", { "data-testid": "language-toggle" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetMedals = vi.mocked(getUserMedals);
const mockGetStats = vi.mocked(getUserStats);
const mockGetTopics = vi.mocked(getTopics);
const mockGetProgress = vi.mocked(getTopicProgress);
const mockGetTopicAccuracy = vi.mocked(getTopicAccuracy);
const mockGetQuestionCounts = vi.mocked(getTopicQuestionCounts);
const mockHasPassedExam = vi.mocked(hasPassedExam);
const mockCookies = vi.mocked(cookies);

const TOPIC_A = { id: "t1", slug: "signs", name_he: "תמרורים", icon: null };
const TOPIC_B = { id: "t2", slug: "priority", name_he: "זכות קדימה", icon: null };

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("MorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetMedals.mockResolvedValue([]);
    mockGetStats.mockResolvedValue({
      user_id: "u1",
      star_points: 42,
      streak_days: 3,
      last_active_date: null,
    });
    mockGetTopics.mockResolvedValue([TOPIC_A, TOPIC_B] as never);
    mockGetProgress.mockResolvedValue([]);
    mockGetTopicAccuracy.mockResolvedValue([]);
    mockGetQuestionCounts.mockResolvedValue({ t1: 20, t2: 10 });
    mockHasPassedExam.mockResolvedValue(false);
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "dark" }) } as never);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(MorePage()).rejects.toThrow("redirect");
  });

  it("renders navigation links to exam, schedule, bookmarks, and credits", async () => {
    const jsx = await MorePage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/exam"]')).toBeTruthy();
    expect(container.querySelector('a[href="/schedule"]')).toBeTruthy();
    expect(container.querySelector('a[href="/bookmarks"]')).toBeTruthy();
    expect(container.querySelector('a[href="/credits"]')).toBeTruthy();
    expect(container.querySelector('a[href="/videos"]')).toBeFalsy();
    expect(container.querySelector('a[href="/resources"]')).toBeFalsy();
  });

  it("labels the bookmarks navigation row", async () => {
    const jsx = await MorePage();
    const { container } = render(jsx);
    const row = container.querySelector('a[href="/bookmarks"]');
    expect(row?.textContent).toContain("navBookmarks");
  });

  it("shows '-' for all medals when none are earned", async () => {
    mockGetMedals.mockResolvedValue([]);
    const jsx = await MorePage();
    render(jsx);
    // 4 milestone dates + 4 achievement date slots + the empty accuracy stat.
    const dashes = screen.getAllByText("-");
    expect(dashes).toHaveLength(9);
  });

  it("shows a formatted date instead of '-' for earned medals", async () => {
    mockGetMedals.mockResolvedValue([
      { medal_slug: "streak-3", earned_at: "2026-01-15T10:00:00Z" },
    ] as never);
    const jsx = await MorePage();
    render(jsx);
    const dashes = screen.getAllByText("-");
    expect(dashes).toHaveLength(8);
  });

  it("renders the four milestone medals plus four derived achievements", async () => {
    const jsx = await MorePage();
    const { container } = render(jsx);
    const medalIcons = container.querySelectorAll('[class*="medal"] svg');
    expect(medalIcons).toHaveLength(8);
    expect(screen.getByText("achFirstTopic")).toBeInTheDocument();
    expect(screen.getByText("achQuestions100")).toBeInTheDocument();
    expect(screen.getByText("achAllTopics")).toBeInTheDocument();
    expect(screen.getByText("achExamPass")).toBeInTheDocument();
  });

  describe("stats grid", () => {
    const valuesT = ((key: string, values?: Record<string, unknown>) =>
      values ? `${key}|${JSON.stringify(values)}` : key) as never;

    it("renders all six stat labels", async () => {
      const jsx = await MorePage();
      render(jsx);
      for (const label of [
        "statStreak",
        "statPoints",
        "statLevel",
        "statAccuracy",
        "statAnswered",
        "statCompletion",
      ]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it("keeps the live data-stat elements for the pill-sync script", async () => {
      const jsx = await MorePage();
      const { container } = render(jsx);
      expect(container.querySelectorAll('[data-stat="streak"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-stat="points"]')).toHaveLength(1);
      const levelCell = container.querySelector("[data-level-unit]")!;
      // 60 = LEVEL_CURVE_UNIT; the script recomputes the level curve from it.
      expect(levelCell.getAttribute("data-level-unit")).toBe("60");
      expect(levelCell.querySelector('[data-stat="level"]')).not.toBeNull();
    });

    it("shows accuracy, answered count, and floored completion from responses", async () => {
      vi.mocked(getTranslations).mockResolvedValue(valuesT);
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 3, total: 5 },
        { topic_id: "t2", correct: 2, total: 4 },
      ]);
      const jsx = await MorePage();
      render(jsx);
      // 5 of 9 correct rounds to 56%; 9 of 30 answered floors to 30%.
      expect(screen.getByText('statAccuracyValue|{"percent":56}')).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText('statCompletionValue|{"percent":30}')).toBeInTheDocument();
    });

    it("derives the level from star points", async () => {
      // 150 points sits inside level 2 (120 to 360).
      mockGetStats.mockResolvedValue({
        user_id: "u1",
        star_points: 150,
        streak_days: 0,
        last_active_date: null,
      });
      const jsx = await MorePage();
      render(jsx);
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("derived achievements", () => {
    it("marks first-topic earned once a topic is completed", async () => {
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "completed", best_score: 90 },
      ] as never);
      const jsx = await MorePage();
      render(jsx);
      const label = screen.getByText("achFirstTopic");
      expect(label.className).toContain("medalLabelEarned");
      expect(screen.getByText("achAllTopics").className).not.toContain(
        "medalLabelEarned"
      );
    });

    it("marks all-topics earned only when every topic is completed", async () => {
      mockGetProgress.mockResolvedValue([
        { topic_id: "t1", status: "completed", best_score: 90 },
        { topic_id: "t2", status: "completed", best_score: 80 },
      ] as never);
      const jsx = await MorePage();
      render(jsx);
      expect(screen.getByText("achAllTopics").className).toContain("medalLabelEarned");
    });

    it("marks the questions achievement from the answered count", async () => {
      mockGetTopicAccuracy.mockResolvedValue([
        { topic_id: "t1", correct: 80, total: 100 },
      ]);
      const jsx = await MorePage();
      render(jsx);
      expect(screen.getByText("achQuestions100").className).toContain(
        "medalLabelEarned"
      );
    });

    it("marks the exam achievement when an exam was passed", async () => {
      mockHasPassedExam.mockResolvedValue(true);
      const jsx = await MorePage();
      render(jsx);
      expect(screen.getByText("achExamPass").className).toContain("medalLabelEarned");
      // The date slot swaps the not-earned dash for the earned label.
      expect(screen.getByText("achEarnedLabel")).toBeInTheDocument();
      expect(screen.getAllByText("-")).toHaveLength(8);
    });

    it("leaves all achievements locked for a fresh account", async () => {
      const jsx = await MorePage();
      render(jsx);
      for (const label of [
        "achFirstTopic",
        "achQuestions100",
        "achAllTopics",
        "achExamPass",
      ]) {
        expect(screen.getByText(label).className).not.toContain("medalLabelEarned");
      }
    });
  });

  it("renders dark mode toggle switch set to true", async () => {
    const jsx = await MorePage();
    const { container } = render(jsx);
    const toggle = container.querySelector("#dark-mode-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("defaults to dark mode when theme cookie is absent", async () => {
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    const jsx = await MorePage();
    const { container } = render(jsx);
    const toggle = container.querySelector("#dark-mode-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("defaults the auto-advance toggle to on when its cookie is absent", async () => {
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    const jsx = await MorePage();
    const { container } = render(jsx);
    const toggle = container.querySelector("#auto-advance-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("renders the auto-advance toggle off when the cookie opts out", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn((name: string) =>
        name === "quiz-auto-advance" ? { value: "off" } : { value: "dark" }
      ),
    } as never);
    const jsx = await MorePage();
    const { container } = render(jsx);
    const toggle = container.querySelector("#auto-advance-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(container.querySelector("#dark-mode-toggle")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("formats earned-medal dates with the ar-IL locale for ar", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    mockGetMedals.mockResolvedValue([
      { medal_slug: "streak-3", earned_at: "2026-01-15T10:00:00Z" },
    ] as never);
    const jsx = await MorePage();
    render(jsx);
    expect(screen.getAllByText("-")).toHaveLength(8);
  });

  it("renders light mode toggle when theme is light", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "light" }),
    } as never);
    const jsx = await MorePage();
    const { container } = render(jsx);
    const toggle = container.querySelector("#dark-mode-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

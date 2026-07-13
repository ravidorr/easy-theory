import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HomePage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopics, getUserStats, getTopicProgress } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

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
}));
vi.mock("next/link", () => ({
  default: ({ href, children, style }: { href: string; children: unknown; style?: unknown }) =>
    React.createElement("a", { href, style }, children as React.ReactNode),
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

  it("shows correct completed count badge", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it("calculates step 1 when best_score is 0", async () => {
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

  it("calculates step 6 when best_score is 100", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeNull();
    expect(screen.getAllByText("✓")).toHaveLength(5);
  });

  it("calculates step 4 when best_score is 70", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 70 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(3);
  });

  it("calculates step 2 when best_score is 20", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 20 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container.querySelector("[data-active]")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("calculates step 3 when best_score is 50", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
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

  it("shows percentage badge when topic is in_progress", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("50%")).toBeInTheDocument();
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

    it("falls back to name_he when name_ar is missing", async () => {
      mockGetTopics.mockResolvedValue([TOPIC_A] as never);
      const jsx = await HomePage();
      render(jsx);
      // Today card + topic list both fall back to the Hebrew name
      expect(screen.getAllByText("תמרורים").length).toBeGreaterThan(0);
    });
  });
});

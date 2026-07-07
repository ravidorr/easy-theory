import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HomePage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopics, getUserStats, getTopicProgress } from "@/lib/db";

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
    expect(screen.getByText("המשימה להיום")).toBeInTheDocument();
    expect(screen.queryByText("מתי נוח לך ללמוד?")).not.toBeInTheDocument();
  });

  it("prefers in_progress topic over not_started as today's task", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
      { topic_id: "t2", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);
    // Today card links to in_progress topic
    const todayLink = container.querySelector('a[href="/topics/priority"]');
    expect(todayLink).toBeTruthy();
  });

  it("falls back to first not_started topic when none in_progress", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    // TOPIC_B has no progress entry → not started → should be today's topic
    expect(screen.getByText("המשימה להיום")).toBeInTheDocument();
  });

  it("shows schedule prompt when all topics are completed", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
      { topic_id: "t2", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText("מתי נוח לך ללמוד?")).toBeInTheDocument();
    expect(screen.queryByText("המשימה להיום")).not.toBeInTheDocument();
  });

  it("shows correct completed count badge", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText(/1 מתוך 2/)).toBeInTheDocument();
  });

  it("calculates step 1 when best_score is 0", async () => {
    mockGetProgress.mockResolvedValue([]);
    const jsx = await HomePage();
    const { container } = render(jsx);
    // PathProgress with current=1 renders step 1 as active (44x44px circle)
    // and steps 2-4 as smaller (34x34px) circles
    expect(container.querySelector('[style*="width: 44px"]')).toBeTruthy();
  });
});

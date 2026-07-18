import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HomePage from "../page";
import { createClient } from "@/lib/supabase";
import {
  getTopics,
  getTopicProgress,
  getExamAttempts,
  getTopicAccuracy,
  getTopicQuestionCounts,
  getQuizAnswerEventCountForWindow,
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
  getTopicProgress: vi.fn(),
  getExamAttempts: vi.fn(),
  getTopicAccuracy: vi.fn(),
  getTopicQuestionCounts: vi.fn(),
  getQuizAnswerEventCountForWindow: vi.fn(),
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
const mockGetProgress = vi.mocked(getTopicProgress);
const mockGetExamAttempts = vi.mocked(getExamAttempts);
const mockGetTopicAccuracy = vi.mocked(getTopicAccuracy);
const mockGetQuestionCounts = vi.mocked(getTopicQuestionCounts);
const mockGetWindowAnswerCount = vi.mocked(getQuizAnswerEventCountForWindow);

const TOPIC_A = { id: "t1", slug: "signs", name_he: "תמרורים", icon: null };
const TOPIC_B = { id: "t2", slug: "priority", name_he: "זכות קדימה", icon: null };

const valuesT = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}|${JSON.stringify(values)}` : key) as never;

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function examAttempt(score: number) {
  return {
    id: "e1",
    score,
    total: 30,
    passed: score >= 26,
    duration_seconds: 1800,
    created_at: "2026-07-19T10:00:00.000Z",
  };
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopics.mockResolvedValue([TOPIC_A, TOPIC_B] as never);
    mockGetProgress.mockResolvedValue([]);
    mockGetExamAttempts.mockResolvedValue([]);
    mockGetTopicAccuracy.mockResolvedValue([]);
    mockGetQuestionCounts.mockResolvedValue({ t1: 20, t2: 10 });
    mockGetWindowAnswerCount.mockResolvedValue(0);
    vi.mocked(getTranslations).mockResolvedValue(valuesT);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects unauthenticated visitors to login", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(HomePage()).rejects.toThrow("redirect");
  });

  it("leads with one daily-task heading and a capped daily-progress line", async () => {
    mockGetWindowAnswerCount.mockResolvedValue(25);
    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByRole("heading", { level: 1, name: "todayBadge" })).toBeInTheDocument();
    expect(screen.getByText('dailyProgress|{"answered":20,"goal":20}')).toBeInTheDocument();
    expect(screen.queryByText("greetingMorning")).not.toBeInTheDocument();
    expect(screen.queryByText("statsStripLabel")).not.toBeInTheDocument();
  });

  it("keeps the daily mission actionable without duration or reward metadata", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await HomePage();
    const { container } = render(jsx);

    expect(screen.getByText('todayTaskDesc|{"count":20}')).toBeInTheDocument();
    expect(container.querySelector('a[href="/topics/signs"].btn-primary')).toHaveTextContent("startBtn");
    expect(screen.queryByText("topicDurationMinutes")).not.toBeInTheDocument();
    expect(screen.queryByText("topicPointsRemaining")).not.toBeInTheDocument();
  });

  it("links a completed weak topic to review when no unanswered questions remain", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 50 },
      { topic_id: "t2", status: "completed", best_score: 50 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 5, total: 20 },
      { topic_id: "t2", correct: 20, total: 20 },
    ]);
    const jsx = await HomePage();
    const { container } = render(jsx);

    expect(container.querySelector('a[href="/topics/signs/review"].btn-primary')).toHaveTextContent(
      "missionReviewBtn"
    );
  });

  it("renders one simulation card and the first-simulation explanation without history", async () => {
    const jsx = await HomePage();
    const { container } = render(jsx);

    expect(container.querySelectorAll('a[href="/exam"]')).toHaveLength(1);
    expect(screen.getByText("readinessEmpty")).toBeInTheDocument();
    expect(screen.queryByText("readinessTitle")).not.toBeInTheDocument();
  });

  it("shows computed readiness inline in the simulation card", async () => {
    mockGetExamAttempts.mockResolvedValue([examAttempt(29)] as never);
    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByText(/examReadiness\|/)).toBeInTheDocument();
    expect(screen.queryByText("readinessEmpty")).not.toBeInTheDocument();
  });

  it("renders one curriculum-ordered list with concise topic statuses", async () => {
    mockGetProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
      { topic_id: "t2", status: "completed", best_score: 85 },
    ] as never);
    mockGetTopicAccuracy.mockResolvedValue([
      { topic_id: "t1", correct: 2, total: 10 },
      { topic_id: "t2", correct: 20, total: 20 },
    ]);
    const jsx = await HomePage();
    const { container } = render(jsx);

    expect(screen.getByRole("heading", { level: 2, name: "topicsHeader" })).toBeInTheDocument();
    expect(screen.getByText("topicNeedsPractice")).toBeInTheDocument();
    expect(screen.getByText("topicCompleted")).toBeInTheDocument();
    expect(container.querySelectorAll('a[href="/topics/signs"]')).toHaveLength(2);
    expect(container.querySelectorAll('a[href="/topics/priority"]')).toHaveLength(1);
    expect(screen.queryByText("weakTopicsHeader")).not.toBeInTheDocument();
    expect(screen.queryByText("topicsAnsweredOverall")).not.toBeInTheDocument();
  });

  it("uses Arabic topic names without Hebrew fallback", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    mockGetTopics.mockResolvedValue([
      { ...TOPIC_A, name_ar: "إشارات المرور" },
    ] as never);
    const jsx = await HomePage();
    render(jsx);

    expect(screen.getAllByText("إشارات المرور").length).toBeGreaterThan(0);
    expect(screen.queryByText("תמרורים")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import TopicsPage from "../page";
import { createClient } from "@/lib/supabase";
import { getTopics, getTopicProgress } from "@/lib/db";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getTopics: vi.fn(),
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
const mockGetTopicProgress = vi.mocked(getTopicProgress);

const TOPIC_1 = { id: "t1", slug: "signs", name_he: "תמרורים", description_he: "זיהוי תמרורים", icon: null };
const TOPIC_2 = { id: "t2", slug: "priority", name_he: "זכות קדימה", description_he: null, icon: null };

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("TopicsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetTopics.mockResolvedValue([TOPIC_1, TOPIC_2] as never);
    mockGetTopicProgress.mockResolvedValue([]);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(TopicsPage()).rejects.toThrow("redirect");
  });

  it("renders all topic names", async () => {
    const jsx = await TopicsPage();
    render(jsx);
    expect(screen.getByText("תמרורים")).toBeInTheDocument();
    expect(screen.getByText("זכות קדימה")).toBeInTheDocument();
  });

  it("shows 'טרם התחלת' when topic has no progress", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_1] as never);
    mockGetTopicProgress.mockResolvedValue([]);
    const jsx = await TopicsPage();
    render(jsx);
    expect(screen.getByText("טרם התחלת")).toBeInTheDocument();
  });

  it("shows '50% הושלם' when topic is in_progress at 50%", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_1] as never);
    mockGetTopicProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 50 },
    ] as never);
    const jsx = await TopicsPage();
    render(jsx);
    expect(screen.getByText("50% הושלם")).toBeInTheDocument();
  });

  it("shows '✓ הושלם' badge when topic is completed", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_1] as never);
    mockGetTopicProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await TopicsPage();
    render(jsx);
    expect(screen.getByText(/✓ הושלם/)).toBeInTheDocument();
  });

  it("shows 'הנושא הושלם' status line when topic is completed", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_1] as never);
    mockGetTopicProgress.mockResolvedValue([
      { topic_id: "t1", status: "completed", best_score: 100 },
    ] as never);
    const jsx = await TopicsPage();
    render(jsx);
    expect(screen.getByText("הנושא הושלם")).toBeInTheDocument();
  });

  it("progress bar width reflects best_score percentage", async () => {
    mockGetTopics.mockResolvedValue([TOPIC_1] as never);
    mockGetTopicProgress.mockResolvedValue([
      { topic_id: "t1", status: "in_progress", best_score: 75 },
    ] as never);
    const jsx = await TopicsPage();
    const { container } = render(jsx);
    const bar = container.querySelector('[style*="width: 75%"]');
    expect(bar).toBeTruthy();
  });

  it("links each topic card to its slug route", async () => {
    const jsx = await TopicsPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/topics/signs"]')).toBeTruthy();
    expect(container.querySelector('a[href="/topics/priority"]')).toBeTruthy();
  });
});

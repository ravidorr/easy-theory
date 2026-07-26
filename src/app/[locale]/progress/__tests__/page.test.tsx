import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ProgressPage from "../page";
import { createClient } from "@/lib/supabase";
import { getExamAttempts, getTopicAccuracy, getUserStats } from "@/lib/db";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getExamAttempts: vi.fn(), getTopicAccuracy: vi.fn(), getUserStats: vi.fn() }));
vi.mock("@/components/TabBar", () => ({ TabBar: () => React.createElement("div", { "data-testid": "tabbar" }) }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn().mockResolvedValue((key: string) => key) }));

const mockCreateClient = vi.mocked(createClient);
const mockGetExamAttempts = vi.mocked(getExamAttempts);
const mockGetTopicAccuracy = vi.mocked(getTopicAccuracy);
const mockGetUserStats = vi.mocked(getUserStats);
function client(user: { id: string } | null = { id: "u1" }) { return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }; }

describe("ProgressPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(client() as never);
    mockGetUserStats.mockResolvedValue({ streak_days: 4 } as never);
    mockGetExamAttempts.mockResolvedValue([] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ total: 3 }, { total: 5 }] as never);
  });

  it("redirects unauthenticated learners", async () => {
    mockCreateClient.mockResolvedValue(client(null) as never);
    await expect(ProgressPage()).rejects.toThrow("redirect");
  });

  it("renders empty readiness and accumulated learner statistics", async () => {
    const { container } = render(await ProgressPage());
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(container.textContent).toContain("4");
    expect(container.textContent).toContain("8");
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });

  it("renders the readiness result once an exam attempt exists", async () => {
    mockGetExamAttempts.mockResolvedValue([{ score: 28, total: 30, passed: true }] as never);
    render(await ProgressPage());
    expect(screen.getByText("readiness")).toBeInTheDocument();
  });
});

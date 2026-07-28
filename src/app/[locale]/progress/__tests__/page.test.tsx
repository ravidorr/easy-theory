import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ProgressPage from "../page";
import { createClient } from "@/lib/supabase";
import { getExamAttempts, getTopicAccuracy, getUserStats } from "@/lib/db";
import { computeReadiness } from "@/lib/readiness";
import { readinessConfidence } from "@/lib/learner-plan";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getExamAttempts: vi.fn(), getTopicAccuracy: vi.fn(), getUserStats: vi.fn() }));
vi.mock("@/lib/readiness", () => ({ computeReadiness: vi.fn() }));
vi.mock("@/lib/learner-plan", () => ({ readinessConfidence: vi.fn() }));
vi.mock("@/components/TabBar", () => ({ TabBar: () => React.createElement("div", { "data-testid": "tabbar" }) }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn().mockResolvedValue((key: string) => `Progress.${key}`) }));

const mockCreateClient = vi.mocked(createClient);
const mockGetExamAttempts = vi.mocked(getExamAttempts);
const mockGetTopicAccuracy = vi.mocked(getTopicAccuracy);
const mockGetUserStats = vi.mocked(getUserStats);
const mockComputeReadiness = vi.mocked(computeReadiness);
const mockReadinessConfidence = vi.mocked(readinessConfidence);
function client(user: { id: string } | null = { id: "u1" }) { return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } }; }

describe("ProgressPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(client() as never);
    mockGetUserStats.mockResolvedValue({ streak_days: 4 } as never);
    mockGetExamAttempts.mockResolvedValue([] as never);
    mockGetTopicAccuracy.mockResolvedValue([{ total: 3 }, { total: 5 }] as never);
    mockComputeReadiness.mockReturnValue({ level: null, probability: null, attemptsUsed: 0 });
    mockReadinessConfidence.mockReturnValue("low");
  });

  it("redirects unauthenticated learners", async () => {
    mockCreateClient.mockResolvedValue(client(null) as never);
    await expect(ProgressPage()).rejects.toThrow("redirect");
  });

  it("renders empty readiness and accumulated learner statistics", async () => {
    render(await ProgressPage());
    expect(screen.getByText("Progress.empty")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progress.title", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progress.readinessTitle", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Progress.streak").tagName).toBe("DT");
    expect(screen.getByText("Progress.answered").tagName).toBe("DT");
    expect(screen.getByText("Progress.simulations").tagName).toBe("DT");
    expect(screen.getByText("4").tagName).toBe("DD");
    expect(screen.getByText("8").tagName).toBe("DD");
    expect(screen.getByText("0").tagName).toBe("DD");
    expect(screen.getByTestId("tabbar")).toBeInTheDocument();
  });

  it.each([
    ["low", "low"],
    ["low", "medium"],
    ["low", "high"],
    ["medium", "low"],
    ["medium", "medium"],
    ["medium", "high"],
    ["high", "low"],
    ["high", "medium"],
    ["high", "high"],
  ] as const)("renders readiness copy for %s readiness with %s evidence", async (level, confidence) => {
    mockGetExamAttempts.mockResolvedValue([{ score: 28, total: 30, passed: true }] as never);
    mockComputeReadiness.mockReturnValue({ level, probability: 0.5, attemptsUsed: 1 } as never);
    mockReadinessConfidence.mockReturnValue(confidence);
    render(await ProgressPage());
    expect(screen.getByText(`Progress.readiness${level[0].toUpperCase()}${level.slice(1)}${confidence[0].toUpperCase()}${confidence.slice(1)}`)).toBeInTheDocument();
    expect(screen.getByText("1").tagName).toBe("DD");
  });
});

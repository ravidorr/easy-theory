import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ExamPage from "../page";
import { createClient } from "@/lib/supabase";
import { getExamAttempts } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import type { ExamAttempt } from "@/lib/db";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getExamAttempts: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
  getLocale: vi.fn(),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active }: { active: string }) => <div data-testid="tabbar" data-active={active} />,
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetExamAttempts = vi.mocked(getExamAttempts);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function attempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return {
    id: "e1",
    score: 27,
    total: 30,
    passed: true,
    duration_seconds: 1800,
    created_at: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

describe("ExamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetExamAttempts.mockResolvedValue([]);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he" as never);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(ExamPage()).rejects.toThrow("redirect");
  });

  it("renders rules and a start link to /exam/run", async () => {
    const jsx = await ExamPage();
    const { container } = render(jsx);
    const startLink = container.querySelector('a[href="/exam/run"]');
    expect(startLink).toBeTruthy();
    expect(startLink?.classList.contains("btn-primary")).toBe(true);
    expect(startLink?.textContent).toBe("startBtn");
    expect(startLink?.querySelector("button")).toBeNull();
    expect(screen.getByText("rulesTitle")).toBeInTheDocument();
    expect(screen.getByText("ruleQuestions")).toBeInTheDocument();
    expect(screen.getByText("ruleTime")).toBeInTheDocument();
    expect(screen.getByText("rulePass")).toBeInTheDocument();
  });

  it("shows the empty state when there are no attempts", async () => {
    const jsx = await ExamPage();
    render(jsx);
    expect(screen.getByText("historyEmpty")).toBeInTheDocument();
    expect(screen.queryByText("bestScore")).toBeNull();
  });

  it("renders a chip only for passed attempts", async () => {
    mockGetExamAttempts.mockResolvedValue([
      attempt({ id: "e1", passed: true }),
      attempt({ id: "e2", score: 20, passed: false, created_at: "2026-06-20T10:00:00Z" }),
    ]);
    const jsx = await ExamPage();
    render(jsx);
    expect(screen.getByText("passChip")).toBeInTheDocument();
    expect(screen.queryByText("failChip")).toBeNull();
    expect(screen.getAllByText("attemptScore")).toHaveLength(2);
    expect(screen.getByText("bestScore")).toBeInTheDocument();
    expect(screen.queryByText("historyEmpty")).toBeNull();
  });

  it("formats attempt dates with the ar-IL locale for ar", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    mockGetExamAttempts.mockResolvedValue([attempt()]);
    const jsx = await ExamPage();
    const { container } = render(jsx);
    expect(container.textContent).toContain("٢٠٢٦");
  });

  it("renders the home TabBar without a top-level close control", async () => {
    const jsx = await ExamPage();
    const { container } = render(jsx);
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "home");
    expect(container.querySelector("a[aria-label='closeLabel']")).toBeNull();
  });
});

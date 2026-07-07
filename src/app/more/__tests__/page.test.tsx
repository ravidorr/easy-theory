import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import MorePage from "../page";
import { createClient } from "@/lib/supabase";
import { getUserMedals } from "@/lib/db";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getUserMedals: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "dark" }),
  }),
}));
vi.mock("next/script", () => ({ default: () => React.createElement("div", null) }));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetMedals = vi.mocked(getUserMedals);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("MorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetMedals.mockResolvedValue([]);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(MorePage()).rejects.toThrow("redirect");
  });

  it("renders navigation links to schedule, videos and resources", async () => {
    const jsx = await MorePage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/schedule"]')).toBeTruthy();
    expect(container.querySelector('a[href="/videos"]')).toBeTruthy();
    expect(container.querySelector('a[href="/resources"]')).toBeTruthy();
  });

  it("shows '—' for all medals when none are earned", async () => {
    mockGetMedals.mockResolvedValue([]);
    const jsx = await MorePage();
    render(jsx);
    // 4 milestones, none earned → four "—" spans
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(4);
  });

  it("shows a formatted date instead of '—' for earned medals", async () => {
    mockGetMedals.mockResolvedValue([
      { medal_slug: "streak-3", earned_at: "2026-01-15T10:00:00Z" },
    ] as never);
    const jsx = await MorePage();
    render(jsx);
    // 3 remaining milestones are not earned → three "—" spans
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(3);
  });

  it("renders all four milestone emojis", async () => {
    const jsx = await MorePage();
    render(jsx);
    expect(screen.getByText("🔥")).toBeInTheDocument();
    expect(screen.getByText("⭐")).toBeInTheDocument();
    expect(screen.getByText("💎")).toBeInTheDocument();
    expect(screen.getByText("🏆")).toBeInTheDocument();
  });

  it("renders dark mode toggle switch", async () => {
    const jsx = await MorePage();
    render(jsx);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import SchedulePage from "../page";
import { createClient } from "@/lib/supabase";
import { getUserSchedule } from "@/lib/db";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getUserSchedule: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, style }: { href: string; children: unknown; style?: unknown }) =>
    React.createElement("a", { href, style }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetUserSchedule = vi.mocked(getUserSchedule);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("SchedulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetUserSchedule.mockResolvedValue([]);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(SchedulePage()).rejects.toThrow("redirect");
  });

  it("shows 'טרם נבחרו ימים' when schedule is empty", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("טרם נבחרו ימים")).toBeInTheDocument();
  });

  it("shows 'בחרי ימים כדי להתחיל' summary when no days selected", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("בחרי ימים כדי להתחיל")).toBeInTheDocument();
  });

  it("renders all 7 day buttons", async () => {
    const jsx = await SchedulePage();
    const { container } = render(jsx);
    const dayBtns = container.querySelectorAll(".day-btn");
    expect(dayBtns).toHaveLength(7);
  });

  it("renders duration buttons for 30, 45, and 60 minutes", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("30 דק׳")).toBeInTheDocument();
    expect(screen.getByText("45 דק׳")).toBeInTheDocument();
    expect(screen.getByText("60 דק׳")).toBeInTheDocument();
  });

  it("marks scheduled day buttons as selected", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 0, duration_minutes: 45, start_time: "08:00:00", notify: true },
      { day_of_week: 3, duration_minutes: 45, start_time: "08:00:00", notify: true },
    ] as never);
    const jsx = await SchedulePage();
    const { container } = render(jsx);
    const selectedDays = container.querySelectorAll('.day-btn[data-selected="true"]');
    expect(selectedDays).toHaveLength(2);
  });

  it("shows session count when days are scheduled", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 1, duration_minutes: 45, start_time: "09:00:00", notify: true },
      { day_of_week: 3, duration_minutes: 45, start_time: "09:00:00", notify: true },
      { day_of_week: 5, duration_minutes: 45, start_time: "09:00:00", notify: true },
    ] as never);
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("נבחרו 3 ימים")).toBeInTheDocument();
  });

  it("shows session summary with session count and duration", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 2, duration_minutes: 60, start_time: "18:00:00", notify: false },
    ] as never);
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("1 מפגשים בשבוע, 60 דק׳ כל אחד")).toBeInTheDocument();
  });

  it("renders notification toggle switch", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
  });

  it("renders the back link to /more", async () => {
    const jsx = await SchedulePage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/more"]')).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import SchedulePage from "../page";
import { createClient } from "@/lib/supabase";
import { getUserSchedule } from "@/lib/db";
import { getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getUserSchedule: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetUserSchedule = vi.mocked(getUserSchedule);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

/** Returns a t-mock that provides 7 comma-separated days for the "days" key */
function makeTranslationsMock() {
  return (key: string) => (key === "days" ? "א,ב,ג,ד,ה,ו,ש" : key);
}

describe("SchedulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetUserSchedule.mockResolvedValue([]);
    vi.mocked(getTranslations).mockResolvedValue(makeTranslationsMock() as never);
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(SchedulePage()).rejects.toThrow("redirect");
  });

  it("shows daysNone when schedule is empty", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("daysNone")).toBeInTheDocument();
  });

  it("shows summaryChoose when no days selected", async () => {
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("summaryChoose")).toBeInTheDocument();
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
    expect(screen.getByText("30 durationUnit")).toBeInTheDocument();
    expect(screen.getByText("45 durationUnit")).toBeInTheDocument();
    expect(screen.getByText("60 durationUnit")).toBeInTheDocument();
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

  it("keeps aria-pressed in sync with data-selected on day and duration buttons", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 0, duration_minutes: 60, start_time: "08:00:00", notify: true },
      { day_of_week: 3, duration_minutes: 60, start_time: "08:00:00", notify: true },
    ] as never);
    const jsx = await SchedulePage();
    const { container } = render(jsx);
    container.querySelectorAll(".day-btn, .duration-btn").forEach((btn) => {
      expect(btn.getAttribute("aria-pressed")).toBe(btn.getAttribute("data-selected"));
    });
    expect(container.querySelectorAll('.day-btn[aria-pressed="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('.duration-btn[aria-pressed="true"]')).toHaveLength(1);
  });

  it("shows daysSelected when days are scheduled", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 1, duration_minutes: 45, start_time: "09:00:00", notify: true },
      { day_of_week: 3, duration_minutes: 45, start_time: "09:00:00", notify: true },
      { day_of_week: 5, duration_minutes: 45, start_time: "09:00:00", notify: true },
    ] as never);
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("daysSelected")).toBeInTheDocument();
  });

  it("shows summarySessions summary with session count", async () => {
    mockGetUserSchedule.mockResolvedValue([
      { day_of_week: 2, duration_minutes: 60, start_time: "18:00:00", notify: false },
    ] as never);
    const jsx = await SchedulePage();
    render(jsx);
    expect(screen.getByText("summarySessions")).toBeInTheDocument();
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

  it("gives the icon-only back link an accessible name", async () => {
    const jsx = await SchedulePage();
    const { container } = render(jsx);
    expect(container.querySelector("a[aria-label='backLabel']")).toBeTruthy();
  });
});

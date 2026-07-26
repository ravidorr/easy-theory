import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TabBar } from "../TabBar";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const labels: Record<string, string> = {
      home: "הבית",
      practice: "תרגול",
      exam: "מבחן",
      mistakes: "טעויות",
      progress: "התקדמות",
    };
    return labels[key] ?? key;
  }),
}));

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

const tabs = [
  { label: "הבית", href: "/" },
  { label: "תרגול", href: "/practice" },
  { label: "מבחן", href: "/exam" },
  { label: "טעויות", href: "/mistakes" },
  { label: "התקדמות", href: "/progress" },
];

describe("TabBar", () => {
  it("renders all five tab labels", async () => {
    render(await TabBar({ active: "home" }));
    for (const { label } of tabs) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders tabs in navigation order", async () => {
    const { container } = render(await TabBar({ active: "home" }));
    expect([...container.querySelectorAll("nav > a")].map((tab) => tab.textContent)).toEqual(
      tabs.map((tab) => expect.stringContaining(tab.label)),
    );
  });

  it("renders correct hrefs for all tabs", async () => {
    render(await TabBar({ active: "home" }));
    for (const { label, href } of tabs) {
      expect(screen.getByText(label).closest("a")).toHaveAttribute("href", href);
    }
  });

  it("wraps every tab icon in an icon pill", async () => {
    const { container } = render(await TabBar({ active: "home" }));
    const pills = container.querySelectorAll("a > span:first-child > svg");
    expect(pills).toHaveLength(tabs.length);
  });

  it("gives every tab the shared press-feedback class", async () => {
    render(await TabBar({ active: "home" }));
    for (const { label } of tabs) {
      expect(screen.getByText(label).closest("a")).toHaveClass("pressable");
    }
  });

  it("marks only the active tab with aria-current", async () => {
    render(await TabBar({ active: "exam" }));
    expect(screen.getByText("מבחן").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("הבית").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("תרגול").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("טעויות").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("התקדמות").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("keeps a section active without marking another route as current", async () => {
    render(await TabBar({ active: "progress", current: null }));
    expect(screen.getByText("התקדמות").closest("a")).toHaveAttribute("data-active", "true");
    for (const { label } of tabs) {
      expect(screen.getByText(label).closest("a")).not.toHaveAttribute("aria-current");
    }
  });
});

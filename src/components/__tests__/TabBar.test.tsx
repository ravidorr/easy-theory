import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TabBar } from "../TabBar";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const labels: Record<string, string> = {
      home: "הבית",
      videos: "סרטונים",
      flashcards: "כרטיסיות",
      links: "קישורים",
      more: "עוד",
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
  { label: "סרטונים", href: "/videos" },
  { label: "כרטיסיות", href: "/flashcards" },
  { label: "קישורים", href: "/resources" },
  { label: "עוד", href: "/more" },
];

describe("TabBar", () => {
  it("renders all five tab labels", async () => {
    render(await TabBar({ active: "home" }));
    for (const { label } of tabs) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
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
    render(await TabBar({ active: "videos" }));
    expect(screen.getByText("סרטונים").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("הבית").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("כרטיסיות").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("קישורים").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("עוד").closest("a")).not.toHaveAttribute("aria-current");
  });
});

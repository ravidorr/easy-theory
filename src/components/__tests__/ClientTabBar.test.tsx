import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ClientTabBar } from "../ClientTabBar";
import { useTranslations } from "next-intl";

vi.mock("next-intl", () => ({ useTranslations: vi.fn() }));

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...props }, children),
}));

describe("ClientTabBar", () => {
  it("translates labels and defaults the current tab to active", () => {
    const t = vi.fn((key: string) => `tab-${key}`);
    vi.mocked(useTranslations).mockReturnValue(t as never);

    render(<ClientTabBar active="exam" />);

    expect(useTranslations).toHaveBeenCalledWith("TabBar");
    for (const key of ["home", "practice", "exam", "progress", "more"]) {
      expect(screen.getByText(`tab-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByText("tab-exam").closest("a")).toHaveAttribute("aria-current", "page");
  });
});

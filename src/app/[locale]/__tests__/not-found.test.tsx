import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import NotFound from "../not-found";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active }: { active: string }) =>
    React.createElement("nav", { "data-testid": "tab-bar", "data-active": active }),
}));

describe("NotFound ([locale])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("renders the translated headline, support line, and labeled sign", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("headline");
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName("signAlt");
  });

  it("links the CTA to the current locale's home", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar");
    render(await NotFound());
    expect(screen.getByText("cta").closest("a")).toHaveAttribute("href", "/ar");
  });

  it("renders the tab bar for recovery navigation", async () => {
    render(await NotFound());
    expect(screen.getByTestId("tab-bar")).toHaveAttribute("data-active", "home");
  });
});

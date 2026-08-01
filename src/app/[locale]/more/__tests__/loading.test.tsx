import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active }: { active: string }) => (
    <div data-testid="tabbar" data-active={active} />
  ),
}));

describe("more page loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the loaded page's progress and account card structure", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[class*="pageSection"]')).toHaveLength(2);
    expect(container.querySelectorAll('[class*="statsGrid"] [data-skeleton="circle"]')).toHaveLength(6);
    expect(container.querySelectorAll('[class*="medalsGrid"] [data-skeleton="circle"]')).toHaveLength(6);
    expect(container.querySelectorAll('[class*="navRow"]')).toHaveLength(5);
    const settingsRows = container.querySelectorAll('[class*="settingsRow"]');
    expect(settingsRows).toHaveLength(4);
    expect(settingsRows[0].querySelector('[data-skeleton="switch"]')).toBeTruthy();
    expect(settingsRows[1].querySelector('[data-skeleton="switch"]')).toBeTruthy();
    const progressCard = container.querySelector('[class*="progressCard"]');
    expect(progressCard).toBeTruthy();
    expect(progressCard?.querySelector('[data-skeleton="lineLg"]')).toBeTruthy();
    expect(container.querySelector('[class*="accountCard"]')).toBeTruthy();
  });

  it("keeps the more tab bar visible", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
  });
});

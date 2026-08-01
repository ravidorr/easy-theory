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

describe("home loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the signed-in dashboard geometry", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="todayCard"]')).toBeTruthy();
    expect(container.querySelector('[class*="examCta"]')).toBeTruthy();
    expect(container.querySelectorAll('[class*="topicLink"]')).toHaveLength(6);
    expect(container.querySelectorAll('[class*="topicLink"] [class*="progressTrack"]')).toHaveLength(6);
  });

  it("keeps the home tab bar visible", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "home");
  });
});

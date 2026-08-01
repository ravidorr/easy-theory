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

describe("resources loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors video and resource sections with their loaded card shapes", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[class*="section"]')).toHaveLength(4);
    expect(container.querySelectorAll('[class*="featuredLink"]')).toHaveLength(1);
    expect(container.querySelectorAll('[class*="rowLink"]')).toHaveLength(5);
    expect(container.querySelectorAll('[class*="resourceLink"]')).toHaveLength(7);
  });

  it("keeps the More tab bar visible without marking it current", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
  });
});

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

  it("mirrors two sections of resource rows", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[data-skeleton="card"]')).toHaveLength(6);
  });

  it("keeps the links tab bar visible", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "links");
  });
});

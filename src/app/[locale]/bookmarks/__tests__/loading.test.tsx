import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => (
    <div data-testid="tabbar" data-active={active} data-current={current ?? "none"} />
  ),
}));

describe("bookmarks loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors bookmarked question cards with their options", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[data-skeleton="card"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-skeleton="block"]')).toHaveLength(8);
  });

  it("keeps the More TabBar visible", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "more");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "none");
  });
});

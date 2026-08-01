import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => (
    <div data-testid="tabbar" data-active={active} data-current={current ?? ""} />
  ),
}));

describe("flashcards loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the flashcard frame, progress track, and two answer buttons", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="progressTrack"]')).toBeTruthy();
    expect(container.querySelector(".flashcard-wrap")).toBeTruthy();
    expect(container.querySelectorAll('[class*="actionsRow"] [data-skeleton="block"]')).toHaveLength(2);
  });

  it("groups the flashcards loading state under Practice without a false current page", async () => {
    render(await Loading());
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-active", "practice");
    expect(screen.getByTestId("tabbar")).toHaveAttribute("data-current", "");
  });
});

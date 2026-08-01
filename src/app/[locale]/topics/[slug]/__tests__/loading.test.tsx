import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => <nav data-tab-bar data-active={active} data-current={current ?? ""} />,
}));

describe("topic quiz loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the quiz chrome, question actions, options, and footer", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="topBar"]')).toBeTruthy();
    expect(container.querySelector(".quiz-slide")).toHaveStyle({ display: "flex" });
    expect(container.querySelectorAll('[class*="questionActions"] [data-skeleton]')).toHaveLength(2);
    expect(container.querySelectorAll('.quiz-option')).toHaveLength(4);
    expect(container.querySelectorAll('.quiz-option [data-skeleton="circle"]')).toHaveLength(4);
    expect(container.querySelectorAll('.quiz-option [data-skeleton="lineFlex"]')).toHaveLength(4);
    expect(container.querySelector('[class*="quizFooter"]')).toBeTruthy();
  });

  it("keeps the Practice section TabBar visible", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-active", "practice");
  });
});

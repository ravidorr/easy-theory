import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => <nav data-tab-bar data-active={active} data-current={current ?? ""} />,
}));

describe("exam run loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the exam progress bar, question slide, and footer controls", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="topBar"]')).toBeTruthy();
    expect(container.querySelectorAll('[class*="topBar"] [data-skeleton="content"]')).toHaveLength(2);
    expect(container.querySelector('[class*="topBar"] [class*="w25"]')).toBeNull();
    expect(container.querySelector(".quiz-slide")).toHaveStyle({ display: "flex" });
    expect(container.querySelectorAll('.quiz-option')).toHaveLength(4);
    expect(container.querySelectorAll('.quiz-option [data-skeleton="circle"]')).toHaveLength(4);
    expect(container.querySelectorAll('.quiz-option [data-skeleton="lineFlex"]')).toHaveLength(4);
    expect(container.querySelector('[class*="examFooter"]')).toBeTruthy();
    expect(container.querySelectorAll('[class*="navButtons"] [data-skeleton="block"]')).toHaveLength(2);
  });

  it("keeps the Exam section TabBar visible without a false current page", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-active", "exam");
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-current", "");
  });
});

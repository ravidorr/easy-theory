import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => <nav data-tab-bar data-active={active} data-current={current ?? ""} />,
}));

describe("schedule loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the schedule header, controls, summary, and save area", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="topBar"]')).toBeTruthy();
    expect(container.querySelectorAll('[class*="dayRow"] [data-skeleton="circle"]')).toHaveLength(7);
    expect(container.querySelectorAll('[class*="durationRow"] [data-skeleton="pillFlex"]')).toHaveLength(3);
    expect(container.querySelector('[class*="timeCard"] [data-skeleton="switch"]')).toBeTruthy();
    expect(container.querySelector('[class*="saveArea"]')).toBeTruthy();
  });

  it("keeps the More section TabBar visible", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-active", "more");
  });
});

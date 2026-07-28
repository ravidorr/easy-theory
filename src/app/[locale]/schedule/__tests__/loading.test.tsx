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

  it("mirrors the seven day buttons and the duration pills", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[data-skeleton="circle"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-skeleton="pill"]')).toHaveLength(4);
  });

  it("keeps the More section TabBar visible", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-active", "more");
  });
});

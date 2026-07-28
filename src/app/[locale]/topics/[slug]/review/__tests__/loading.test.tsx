import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: ({ active, current }: { active: string; current?: string | null }) => <nav data-tab-bar data-active={active} data-current={current ?? ""} />,
}));

describe("mistakes review loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors a short list of reviewed question cards", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[data-skeleton="card"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-skeleton="block"]')).toHaveLength(12);
  });

  it("keeps the Practice section TabBar visible", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector("[data-tab-bar]")).toHaveAttribute("data-active", "practice");
  });
});

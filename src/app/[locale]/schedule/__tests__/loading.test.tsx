import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
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
});

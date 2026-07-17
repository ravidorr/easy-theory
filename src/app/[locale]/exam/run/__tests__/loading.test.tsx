import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("exam run loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors a question slide with four options and two nav buttons", async () => {
    const { container } = render(await Loading());
    expect(container.querySelectorAll('[data-skeleton="block"]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-skeleton="pill"]')).toHaveLength(1);
  });
});

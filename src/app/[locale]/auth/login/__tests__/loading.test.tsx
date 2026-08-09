import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("login loading skeleton", () => {
  it("announces loading and marks the content busy", async () => {
    const { container } = render(await Loading());
    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the simplified landing page's hero and login card", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="hero"]')).toBeTruthy();
    expect(container.querySelector('[class*="loginCard"]')).toBeTruthy();
    expect(container.querySelector('[class*="phoneFrame"]')).toBeNull();
    expect(container.querySelectorAll('[class*="featureCard"]')).toHaveLength(0);
    expect(container.querySelector("nav")).toBeNull();
  });
});

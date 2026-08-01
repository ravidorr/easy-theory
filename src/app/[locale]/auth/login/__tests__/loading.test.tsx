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

  it("mirrors the landing page's hero, login, preview, and content sections", async () => {
    const { container } = render(await Loading());
    expect(container.querySelector('[class*="hero"]')).toBeTruthy();
    expect(container.querySelector('[class*="loginCard"]')).toBeTruthy();
    expect(container.querySelector('[class*="phoneFrame"]')).toBeTruthy();
    expect(container.querySelectorAll('[class*="phoneFrameSmall"]')).toHaveLength(2);
    expect(container.querySelectorAll('[class*="featureCard"]')).toHaveLength(3);
    expect(container.querySelector('[class*="faqCard"]')).toBeTruthy();
    expect(container.querySelector("nav")).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "../loading";
import styles from "../page.module.css";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("about loading skeleton", () => {
  it("announces loading and marks the marketing page busy", async () => {
    const { container } = render(await Loading());

    expect(screen.getByRole("status")).toHaveTextContent("label");
    expect(container.querySelector("main")).toHaveAttribute("aria-busy", "true");
  });

  it("mirrors the About page's hero, phone previews, cards, FAQ, and CTA", async () => {
    const { container } = render(await Loading());

    expect(container.querySelector('[class*="hero"]')).toBeTruthy();
    expect(container.getElementsByClassName(styles.phoneFrame)).toHaveLength(1);
    expect(container.getElementsByClassName(styles.phoneFrameSmall)).toHaveLength(2);
    expect(container.getElementsByClassName(styles.featureCard)).toHaveLength(3);
    expect(container.getElementsByClassName(styles.faqItem)).toHaveLength(4);
    expect(container.getElementsByClassName(styles.closeCard)).toHaveLength(1);
  });

  it("does not render the inherited dashboard shell or tab bar", async () => {
    const { container } = render(await Loading());

    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelector('[data-skeleton="bar"]')).toBeNull();
  });
});

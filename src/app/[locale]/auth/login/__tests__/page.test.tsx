import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import LoginPage, { generateMetadata } from "../page";

const mockCookies = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

async function renderPage(next?: string, locale = "he") {
  const jsx = await LoginPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(next ? { next } : {}),
  });
  return render(jsx);
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ get: () => undefined });
  });

  it("renders the email input", async () => {
    await renderPage();
    const emailInput = screen.getByRole("textbox");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders the submit button", async () => {
    await renderPage();
    const btn = document.getElementById("send-btn");
    expect(btn).toBeTruthy();
  });

  it("renders the login page heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the localized brand tagline", async () => {
    await renderPage();
    expect(screen.getByText("tagline")).toBeInTheDocument();
  });

  it("renders the login card title heading", async () => {
    await renderPage();
    expect(screen.getByText("loginCardTitle")).toBeInTheDocument();
  });

  it("renders the footer lines", async () => {
    const { container } = await renderPage();
    const footer = container.querySelector("footer");
    expect(footer).toBeTruthy();
  });

  it("renders the login form", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("#login-form")).toBeTruthy();
  });

  it("embeds next path in hidden input when valid", async () => {
    const { container } = await renderPage("/topics/signs/review");
    const input = container.querySelector<HTMLInputElement>("#next-path");
    expect(input).toBeTruthy();
    expect(input?.value).toBe("/topics/signs/review");
  });

  it("defaults hidden input to /schedule when next is absent", async () => {
    const { container } = await renderPage();
    const input = container.querySelector<HTMLInputElement>("#next-path");
    expect(input?.value).toBe("/schedule");
  });

  it("defaults hidden input to /schedule when next is not a relative path", async () => {
    const { container } = await renderPage("https://evil.com");
    const input = container.querySelector<HTMLInputElement>("#next-path");
    expect(input?.value).toBe("/schedule");
  });

  it("shows the link-expired alert when error=1", async () => {
    const jsx = await LoginPage({
      params: Promise.resolve({ locale: "he" }),
      searchParams: Promise.resolve({ error: "1" }),
    });
    render(jsx);
    expect(screen.getByText("linkExpired")).toBeInTheDocument();
  });

  it("does not show the link-expired alert without the error param", async () => {
    await renderPage();
    expect(screen.queryByText("linkExpired")).not.toBeInTheDocument();
  });

  it("renders the trust badge and hero screenshot", async () => {
    await renderPage();
    expect(screen.getByText("trustBadge")).toBeInTheDocument();
    expect(screen.getByAltText("screenshotHomeAlt")).toBeInTheDocument();
  });

  it("uses screenshot assets for the current locale", async () => {
    const { unmount } = await renderPage();
    for (const screenName of ["Home", "Quiz", "Cards"] as const) {
      expect(screen.getByAltText(`screenshot${screenName}Alt`)).toHaveAttribute(
        "src",
        `/landing/screenshot-${screenName.toLowerCase()}-he-dark.png`
      );
    }
    unmount();

    await renderPage(undefined, "ar");
    for (const screenName of ["Home", "Quiz", "Cards"] as const) {
      expect(screen.getByAltText(`screenshot${screenName}Alt`)).toHaveAttribute(
        "src",
        `/landing/screenshot-${screenName.toLowerCase()}-ar-dark.png`
      );
    }
  });

  it("uses light screenshot assets when the light theme is active", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "light" }) });
    await renderPage(undefined, "ar");
    for (const screenName of ["Home", "Quiz", "Cards"] as const) {
      expect(screen.getByAltText(`screenshot${screenName}Alt`)).toHaveAttribute(
        "src",
        `/landing/screenshot-${screenName.toLowerCase()}-ar-light.png`
      );
    }
  });

  it("renders the three outcome-first feature cards, plan first", async () => {
    await renderPage();
    const titles = [
      "featurePlanTitle",
      "featureQuestionsTitle",
      "featureCardsTitle",
    ].map((key) => screen.getByText(key));
    expect(titles[0].compareDocumentPosition(titles[1])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(titles[1].compareDocumentPosition(titles[2])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("renders the peek-inside screenshots", async () => {
    await renderPage();
    expect(screen.getByAltText("screenshotQuizAlt")).toBeInTheDocument();
    expect(screen.getByAltText("screenshotCardsAlt")).toBeInTheDocument();
  });

  it("renders all four FAQ items", async () => {
    await renderPage();
    for (const i of [1, 2, 3, 4]) {
      expect(screen.getByText(`faq${i}Q`)).toBeInTheDocument();
      expect(screen.getByText(`faq${i}A`)).toBeInTheDocument();
    }
  });

  it("renders the emotional close with a CTA anchored to the login card", async () => {
    const { container } = await renderPage();
    const cta = screen.getByText("closeCta");
    expect(cta).toHaveAttribute("href", "#login-card");
    expect(container.querySelector("#login-card")).toBeTruthy();
  });

  it("renders the success card content hidden by default", async () => {
    const { container } = await renderPage();
    const banner = container.querySelector("#sent-banner");
    expect(banner).toBeTruthy();
    expect(screen.getByText("sentTitle")).toBeInTheDocument();
    expect(screen.getByText("resendBtn")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("uses he_IL openGraph locale for he", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "he" }) });
    expect(meta.openGraph?.locale).toBe("he_IL");
    expect(meta.title).toBe("metaTitle");
    expect(meta.description).toBe("metaDescription");
  });

  it("uses ar_IL openGraph locale for ar", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "ar" }) });
    expect(meta.openGraph?.locale).toBe("ar_IL");
  });
});

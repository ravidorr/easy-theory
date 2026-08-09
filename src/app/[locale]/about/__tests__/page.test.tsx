import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import AboutPage, { generateMetadata } from "../page";

const mockCookies = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

describe("AboutPage", () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ get: () => undefined });
  });

  it("renders the moved marketing content and returns visitors to login", async () => {
    render(await AboutPage({
      params: Promise.resolve({ locale: "he" }),
      searchParams: Promise.resolve({ next: "/topics/signs/review" }),
    }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("heroH1");
    expect(screen.getByText("featuresTitle")).toBeInTheDocument();
    expect(screen.getByAltText("screenshotHomeAlt")).toHaveAttribute(
      "src",
      "/landing/screenshot-home-he-dark.png"
    );
    expect(screen.getByAltText("screenshotQuizAlt")).toBeInTheDocument();
    expect(screen.getByAltText("screenshotCardsAlt")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(7);
    expect(screen.getByRole("link", { name: "closeCta" })).toHaveAttribute(
      "href",
      "/auth/login?next=%2Ftopics%2Fsigns%2Freview#login-card"
    );
  });

  it("uses locale and theme-specific screenshots", async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: "light" }) });
    render(await AboutPage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByAltText("screenshotHomeAlt")).toHaveAttribute(
      "src",
      "/landing/screenshot-home-ar-light.png"
    );
  });
});

describe("generateMetadata", () => {
  it("uses the localized about metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "he" }) });
    expect(meta.title).toBe("metaTitle");
    expect(meta.description).toBe("metaDescription");
    expect(meta.openGraph?.locale).toBe("he_IL");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import LoginPage, { generateMetadata } from "../page";

vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

async function renderPage(next?: string) {
  const jsx = await LoginPage({
    params: Promise.resolve({ locale: "he" }),
    searchParams: Promise.resolve(next ? { next } : {}),
  });
  return render(jsx);
}

describe("LoginPage", () => {
  it("renders the focused login form", async () => {
    const { container } = await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("heroH1");
    expect(screen.getByText("tagline")).toBeInTheDocument();
    expect(screen.getByText("loginCardTitle")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
    expect(document.getElementById("send-btn")).toBeTruthy();
    expect(container.querySelector("#login-form")).toBeTruthy();
    expect(screen.queryByText("heroH2")).toBeNull();
    expect(screen.queryByText("featuresTitle")).toBeNull();
  });

  it("preserves a protected destination in the public information link", async () => {
    await renderPage("/topics/signs/review");
    expect(screen.getByRole("link", { name: "aboutLink" })).toHaveAttribute(
      "href",
      "/about?next=%2Ftopics%2Fsigns%2Freview"
    );
  });

  it("preserves valid next paths and rejects external ones", async () => {
    const { container, unmount } = await renderPage("/topics/signs/review");
    expect(container.querySelector<HTMLInputElement>("#next-path")?.value).toBe("/topics/signs/review");
    unmount();

    const invalid = await renderPage("https://evil.com");
    expect(invalid.container.querySelector<HTMLInputElement>("#next-path")?.value).toBe("/schedule");
  });

  it("shows the expired-link error and keeps the success content ready", async () => {
    const jsx = await LoginPage({
      params: Promise.resolve({ locale: "he" }),
      searchParams: Promise.resolve({ error: "1" }),
    });
    const { container } = render(jsx);

    expect(screen.getByText("linkExpired")).toBeInTheDocument();
    expect(container.querySelector("#sent-banner")).toBeTruthy();
    expect(screen.getByText("sentTitle")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("uses the localized login metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "ar" }) });
    expect(meta.title).toBe("metaTitle");
    expect(meta.description).toBe("metaDescription");
    expect(meta.openGraph?.locale).toBe("ar_IL");
  });

  it("uses Hebrew Open Graph locale metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "he" }) });
    expect(meta.openGraph?.locale).toBe("he_IL");
  });
});

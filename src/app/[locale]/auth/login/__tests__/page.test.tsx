import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import LoginPage, { generateMetadata } from "../page";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

async function renderPage(next?: string) {
  const jsx = await LoginPage({ searchParams: Promise.resolve(next ? { next } : {}) });
  return render(jsx);
}

describe("LoginPage", () => {
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

  it("defaults hidden input to / when next is absent", async () => {
    const { container } = await renderPage();
    const input = container.querySelector<HTMLInputElement>("#next-path");
    expect(input?.value).toBe("/");
  });

  it("defaults hidden input to / when next is not a relative path", async () => {
    const { container } = await renderPage("https://evil.com");
    const input = container.querySelector<HTMLInputElement>("#next-path");
    expect(input?.value).toBe("/");
  });

  it("shows the link-expired alert when error=1", async () => {
    const jsx = await LoginPage({ searchParams: Promise.resolve({ error: "1" }) });
    render(jsx);
    expect(screen.getByText("linkExpired")).toBeInTheDocument();
  });

  it("does not show the link-expired alert without the error param", async () => {
    await renderPage();
    expect(screen.queryByText("linkExpired")).not.toBeInTheDocument();
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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import LoginPage from "../page";

vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
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
    expect(
      screen.getByRole("button", { name: /שלחי לי קישור/ })
    ).toBeInTheDocument();
  });

  it("renders the app wordmark", async () => {
    await renderPage();
    expect(screen.getByText("דרך ברורה")).toBeInTheDocument();
  });

  it("renders the login card heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "להתחיל עכשיו" })).toBeInTheDocument();
  });

  it("renders the ClearRoad brand name in the footer", async () => {
    await renderPage();
    expect(screen.getByText(/ClearRoad/)).toBeInTheDocument();
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
});
